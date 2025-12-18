/**
 * Virtual Queue Management System - Backend (Final Integrated Version)
 * Features: Auth, Priority Algo, Smart Metrics, Simulation, Stakeholder Mgmt
 */

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
require('dotenv').config(); // Load .env variables

// Initialize System
const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const io = new Server(server, {
  cors: { origin: "*" }
});

// Use environment variable or fallback
const SECRET_KEY = process.env.JWT_SECRET || "fallback-secret-key";

app.use(cors());
app.use(express.json());

// --- UTILITIES ---

// 1. Priority Score Calculator
const calculatePriorityScore = (ticketClass, isSpecialNeeds, joinedAt) => {
  let score = 0;
  if (ticketClass === 'FIRST') score += 500;
  else if (ticketClass === 'BUSINESS') score += 300;
  else score += 100;

  if (isSpecialNeeds) score += 400;

  // Dynamic Aging: Score increases by 2 points every minute you wait
  const waitTimeMinutes = (new Date() - new Date(joinedAt)) / 60000;
  score += Math.floor(waitTimeMinutes * 2);

  return score;
};

// 2. Smart Metric: Real-Time Service Rate
// Calculates how many minutes it takes on average to serve a passenger
async function getAverageServiceTime(flightId) {
  const completed = await prisma.queueEntry.findMany({
    where: { flightId, status: 'COMPLETED' },
    orderBy: { serviceCompletedAt: 'desc' },
    take: 10 // Look at last 10 passengers
  });

  if (completed.length === 0) return 3; // Default: 3 mins if no history

  const totalDuration = completed.reduce((acc, entry) => {
    if (entry.serviceStartedAt && entry.serviceCompletedAt) {
      return acc + (new Date(entry.serviceCompletedAt) - new Date(entry.serviceStartedAt));
    }
    return acc + 180000; // Default 3 mins if timestamps broken
  }, 0);

  const avgMs = totalDuration / completed.length;
  return Math.ceil(avgMs / 60000); // Return minutes
}

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, name } = req.body;

  if (!username || !email || !password || !name) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { username: username }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email) {
          return res.status(400).json({ error: "Email already exists" });
      }
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        name,
        role: "PASSENGER"
      }
    });

    res.status(201).json({ message: "User registered successfully", user: newUser });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, username, password } = req.body;
  
  const loginInput = email || username;

  if (!loginInput || !password) {
      return res.status(400).json({ error: "Please provide email/username and password" });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginInput },
          { username: loginInput }
        ]
      }
    });

    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// --- STAKEHOLDER MGMT (Flights) ---

// Create Flight (Protected: Admin Only)
app.post('/api/admin/flights', authenticateToken, requireAdmin, async (req, res) => {
  console.log("Creating Flight Payload:", req.body);

  const { flightCode, destination, departureTime } = req.body;

  if (!flightCode || !destination || !departureTime) {
      return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const flight = await prisma.flight.create({
      data: {
        flightCode: flightCode,       
        destination: destination,
        departureTime: new Date(departureTime),
        status: "SCHEDULED"
        // REMOVED: origin, price (Not in your database schema)
      }
    });
    res.status(201).json(flight);
  } catch (error) {
    console.error("CREATE FLIGHT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get Flights (Public)
app.get('/api/flights', async (req, res) => {
  try {
    const flights = await prisma.flight.findMany({ orderBy: { departureTime: 'asc' } });
    res.json(flights);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

// --- QUEUE ROUTES ---

// Join Queue (Protected: Logged in Users)
app.post('/api/queue/join', authenticateToken, async (req, res) => {
  try {
    // SECURE: Get userId from the token, not the body (prevents spoofing)
    const userId = req.user.id; 
    const { flightId, ticketClass, isSpecialNeeds } = req.body;

    // Check Duplicate
    const existing = await prisma.queueEntry.findFirst({
        where: { userId, flightId, status: { in: ['WAITING', 'CALLED'] } }
    });
    if (existing) return res.status(400).json({ error: "Already in queue" });

    // Calculate Score
    const initialScore = calculatePriorityScore(ticketClass, isSpecialNeeds, new Date());

    const entry = await prisma.queueEntry.create({
      data: {
        userId, flightId, ticketClass, isSpecialNeeds,
        priorityScore: initialScore,
        status: 'WAITING'
      },
      include: { user: true, flight: true }
    });

    io.emit('admin:queue_update', entry);
    io.emit(`flight:${flightId}:update`); 
    
    res.json({ success: true, entry });
  } catch (error) {
    console.error("Join Queue Error:", error);
    res.status(500).json({ error: "Join failed" });
  }
});

// Check Active Session (Persistence) (Protected)
app.get('/api/queue/active', authenticateToken, async (req, res) => {
  try {
    // SECURE: Get userId from token
    const userId = req.user.id;
    
    const activeEntry = await prisma.queueEntry.findFirst({
      where: { userId, status: { in: ['WAITING', 'CALLED'] } },
      include: { flight: true }
    });

    if (!activeEntry) return res.status(200).json({ entry: null });

    // Recalculate Position
    const position = await prisma.queueEntry.count({
      where: {
        flightId: activeEntry.flightId,
        status: 'WAITING',
        OR: [
          { priorityScore: { gt: activeEntry.priorityScore } },
          { priorityScore: activeEntry.priorityScore, joinedAt: { lt: activeEntry.joinedAt } }
        ]
      }
    });

    // Smart Wait Time
    const avgServiceTime = await getAverageServiceTime(activeEntry.flightId);

    res.json({
      entry: {
        ...activeEntry,
        position: position + 1,
        estimatedWaitTime: (position + 1) * avgServiceTime
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Status (Polling/Refresh) (Protected)
app.get('/api/queue/status/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const myEntry = await prisma.queueEntry.findUnique({ where: { id } });
    if (!myEntry) return res.status(404).json({ error: "Not found" });

    const position = await prisma.queueEntry.count({
      where: {
        flightId: myEntry.flightId, status: 'WAITING',
        OR: [
          { priorityScore: { gt: myEntry.priorityScore } },
          { priorityScore: myEntry.priorityScore, joinedAt: { lt: myEntry.joinedAt } }
        ]
      }
    });

    const avgServiceTime = await getAverageServiceTime(myEntry.flightId);

    res.json({ 
      ...myEntry, 
      position: position + 1, 
      estimatedWaitTime: (position + 1) * avgServiceTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN OPERATIONS ---

// Get Queue (Protected: Admin Only)
app.get('/api/admin/queue/:flightId', authenticateToken, requireAdmin, async (req, res) => {
  const { flightId } = req.params;
  const queue = await prisma.queueEntry.findMany({
    where: { flightId, status: { in: ['WAITING', 'CALLED'] } },
    include: { user: true },
    orderBy: [
      { status: 'asc' }, // CALLED first
      { priorityScore: 'desc' },
      { joinedAt: 'asc' }
    ]
  });
  res.json(queue);
});

// Call Next Passenger (Protected: Admin Only)
app.post('/api/admin/call-next', authenticateToken, requireAdmin, async (req, res) => {
  const { flightId, counterId } = req.body;

  // 1. Complete previous person
  const currentServing = await prisma.queueEntry.findFirst({
    where: { flightId, status: 'CALLED' }
  });

  if (currentServing) {
    await prisma.queueEntry.update({
      where: { id: currentServing.id },
      data: { status: 'COMPLETED', serviceCompletedAt: new Date() }
    });
  }

  // 2. Find Next
  const nextPassenger = await prisma.queueEntry.findFirst({
    where: { flightId, status: 'WAITING' },
    orderBy: [{ priorityScore: 'desc' }, { joinedAt: 'asc' }],
    include: { user: true }
  });

  if (!nextPassenger) {
    io.emit('admin:queue_update');
    return res.status(200).json({ message: "Queue is empty" });
  }

  // 3. Update Status
  const updated = await prisma.queueEntry.update({
    where: { id: nextPassenger.id },
    data: { status: 'CALLED', serviceStartedAt: new Date() }
  });

  // Notify
  io.emit(`passenger:${nextPassenger.userId}`, { 
    type: 'CALLED', 
    counter: counterId, 
    message: `Proceed to ${counterId}` 
  });
  io.emit('admin:queue_update', updated);
  io.emit(`flight:${flightId}:update`);

  res.json({ success: true, passenger: updated });
});

// Metrics (Protected: Admin Only)
app.get('/api/admin/metrics/:flightId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { flightId } = req.params;
    const waiting = await prisma.queueEntry.findMany({
      where: { flightId, status: 'WAITING' },
      select: { ticketClass: true, isSpecialNeeds: true }
    });

    const avgWait = await getAverageServiceTime(flightId);
    
    res.json({
      queueLength: waiting.length,
      priorityCount: waiting.filter(p => p.ticketClass !== 'ECONOMY' || p.isSpecialNeeds).length,
      avgWaitTime: waiting.length * avgWait // Total estimated time to clear queue
    });
  } catch (error) { res.status(500).json({ error: "Metrics error" }); }
});

// Simulation (Protected: Admin Only)
app.post('/api/admin/simulate', authenticateToken, requireAdmin, async (req, res) => {
  const { flightId, count = 5 } = req.body;
  const classes = ['ECONOMY', 'ECONOMY', 'BUSINESS', 'FIRST'];
  
  for (let i = 0; i < count; i++) {
    const ticketClass = classes[Math.floor(Math.random() * classes.length)];
    const isSpecialNeeds = Math.random() > 0.8;
    const userId = `bot-${Date.now()}-${i}`;
    
    // Create Temp Bot User
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@bot.com`,
        username: `bot_${i}_${Date.now()}`, // Added username for schema compliance
        name: `Bot ${ticketClass.substring(0,3)} ${Math.floor(Math.random()*100)}`,
        password: "bot",
        role: 'PASSENGER'
      }
    });

    const score = calculatePriorityScore(ticketClass, isSpecialNeeds, new Date());
    await prisma.queueEntry.create({
      data: {
        userId, flightId, ticketClass, isSpecialNeeds, priorityScore: score, status: 'WAITING'
      }
    });
  }
  io.emit('admin:queue_update');
  io.emit(`flight:${flightId}:update`);
  res.json({ success: true });
});

// Reset System (Protected: Admin Only)
app.post('/api/admin/reset', authenticateToken, requireAdmin, async (req, res) => {
  await prisma.queueEntry.deleteMany({});
  io.emit('admin:queue_update');
  res.json({ success: true });
});

// --- SERVER START ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));