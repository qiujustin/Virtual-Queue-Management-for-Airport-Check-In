// Virtual Queue Management System - Backend

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const io = new Server(server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET || "fallback-secret-key";

/* Priority Calculation Utilities */

// Calculates a priority score based on ticket class, accessibility needs, wait time, and flight departure urgency.
const calculatePriorityScore = (ticketClass, isSpecialNeeds, joinedAt, departureTime) => {
  let score = 0;
  
  // Base score determined by ticket class
  if (ticketClass === 'FIRST') score += 500;
  else if (ticketClass === 'BUSINESS') score += 300;
  else score += 100;

  // Accessibility adjustment
  if (isSpecialNeeds) score += 400;

  // Wait time adjustment: Score increases by 2 points per minute
  const now = new Date();
  const waitTimeMinutes = (now - new Date(joinedAt)) / 60000;
  score += Math.floor(waitTimeMinutes * 2);

  // Urgency adjustment: Increase score if flight departs within 90 minutes
  if (departureTime) {
      const minutesToDeparture = (new Date(departureTime) - now) / 60000;
      
      if (minutesToDeparture > 0 && minutesToDeparture < 90) {
          score += Math.floor((90 - minutesToDeparture) * 10);
      }
  }

  return score;
};

// Calculate average service time based on the last 10 completed entries
async function getAverageServiceTime(flightId) {
  const completed = await prisma.queueEntry.findMany({
    where: { flightId, status: 'COMPLETED' },
    orderBy: { serviceCompletedAt: 'desc' },
    take: 10 
  });

  if (completed.length === 0) return 3; 

  const totalDuration = completed.reduce((acc, entry) => {
    if (entry.serviceStartedAt && entry.serviceCompletedAt) {
      return acc + (new Date(entry.serviceCompletedAt) - new Date(entry.serviceStartedAt));
    }
    return acc + 180000; 
  }, 0);

  const avgMs = totalDuration / completed.length;
  return Math.ceil(avgMs / 60000); 
}

/* Authentication Routes */

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, name } = req.body;

  if (!username || !email || !password || !name) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
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

    const token = jwt.sign(
        { id: newUser.id, role: newUser.role, name: newUser.name }, 
        SECRET_KEY, 
        { expiresIn: '24h' }
    );

    res.status(201).json({ message: "User registered successfully", user: newUser, token });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, username, password } = req.body;
  const loginInput = email || username;

  if (!loginInput || !password) {
      return res.status(400).json({ error: "Please provide credentials" });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: loginInput }, { username: loginInput }] }
    });

    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name }, 
      SECRET_KEY, 
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/* Flight Management Routes */

app.post('/api/admin/flights', authenticateToken, requireAdmin, async (req, res) => {
  const { flightCode, destination, departureTime } = req.body;

  try {
    const flight = await prisma.flight.create({
      data: {
        flightCode,       
        destination,
        departureTime: new Date(departureTime),
        status: "SCHEDULED"
      }
    });
    res.status(201).json(flight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/flights', async (req, res) => {
  try {
    const flights = await prisma.flight.findMany({ orderBy: { departureTime: 'asc' } });
    res.json(flights);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

/* Queue Management Routes */

app.post('/api/queue/join', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; 
    const { flightId, ticketClass, isSpecialNeeds } = req.body;

    const existing = await prisma.queueEntry.findFirst({
        where: { userId, flightId, status: { in: ['WAITING', 'CALLED'] } }
    });
    if (existing) return res.status(400).json({ error: "Already in queue" });

    const flight = await prisma.flight.findUnique({ where: { id: flightId } });
    if (!flight) return res.status(404).json({ error: "Flight not found" });

    const initialScore = calculatePriorityScore(
        ticketClass, 
        isSpecialNeeds, 
        new Date(), 
        flight.departureTime
    );

    const entry = await prisma.queueEntry.create({
      data: {
        userId, 
        flightId, 
        ticketClass, 
        isSpecialNeeds,
        priorityScore: initialScore,
        status: 'WAITING'
      },
      include: { user: true, flight: true }
    });

    io.emit('queue_update'); 
    io.emit(`flight:${flightId}:update`);
    
    res.json({ success: true, entry });
  } catch (error) {
    console.error("Join Queue Error:", error);
    res.status(500).json({ error: "Join failed" });
  }
});

app.get('/api/queue/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const myEntry = await prisma.queueEntry.findFirst({
      where: { userId, status: { in: ['WAITING', 'CALLED'] } },
      include: { flight: true }
    });

    if (!myEntry) return res.json({ entry: null });

    const position = await prisma.queueEntry.count({
      where: {
        flightId: myEntry.flightId,
        status: 'WAITING',
        OR: [
          { priorityScore: { gt: myEntry.priorityScore } },
          { priorityScore: myEntry.priorityScore, joinedAt: { lt: myEntry.joinedAt } }
        ]
      }
    });

    const avgServiceTime = await getAverageServiceTime(myEntry.flightId);
    
    // Adjust predicted wait time based on queue length congestion
    const totalQueue = await prisma.queueEntry.count({ where: { flightId: myEntry.flightId, status: 'WAITING' }});
    const trafficFactor = totalQueue > 10 ? 1.2 : 1.0;

    const estimatedTime = myEntry.status === 'CALLED' 
        ? 0 
        : Math.ceil((position + 1) * avgServiceTime * trafficFactor);

    res.json({ 
      entry: {
        ...myEntry, 
        position: myEntry.status === 'CALLED' ? 0 : position + 1, 
        estimatedWaitTime: estimatedTime
      }
    });
  } catch (error) {
    console.error("Status Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* Admin Operations */

app.get('/api/admin/queue/:flightId', authenticateToken, requireAdmin, async (req, res) => {
  const { flightId } = req.params;
  
  try {
    const queue = await prisma.queueEntry.findMany({
      where: { 
        flightId: flightId, 
        status: { in: ['WAITING', 'CALLED'] } 
      },
      include: { user: true },
      orderBy: [
        { status: 'asc' }, 
        { priorityScore: 'desc' },
        { joinedAt: 'asc' }
      ]
    });
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign next passenger to a counter
app.post('/api/admin/call-next', authenticateToken, requireAdmin, async (req, res) => {
  const { flightId, counterId } = req.body;

  const nextPassenger = await prisma.queueEntry.findFirst({
    where: { flightId, status: 'WAITING' },
    orderBy: [{ priorityScore: 'desc' }, { joinedAt: 'asc' }],
    include: { user: true }
  });

  if (!nextPassenger) {
    return res.status(200).json({ message: "Queue is empty" });
  }

  const updated = await prisma.queueEntry.update({
    where: { id: nextPassenger.id },
    data: { 
      status: 'CALLED', 
      assignedCounter: counterId,
      serviceStartedAt: new Date() 
    },
    include: { user: true }
  });

  io.emit(`passenger:${nextPassenger.userId}`, { 
    type: 'CALLED', 
    counter: counterId, 
    message: `Please proceed to ${counterId}` 
  });
  
  io.emit('queue_update'); 
  io.emit(`flight:${flightId}:update`);

  res.json({ success: true, passenger: updated });
});

app.post('/api/admin/complete-service', authenticateToken, requireAdmin, async (req, res) => {
  const { entryId } = req.body;

  try {
    await prisma.queueEntry.update({
      where: { id: entryId },
      data: { 
        status: 'COMPLETED',
        assignedCounter: null,
        serviceCompletedAt: new Date() 
      }
    });

    io.emit('queue_update');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to complete service" });
  }
});

app.post('/api/admin/noshow', authenticateToken, requireAdmin, async (req, res) => {
  const { entryId } = req.body;

  try {
    await prisma.queueEntry.update({
      where: { id: entryId },
      data: { 
        status: 'NOSHOW',
        assignedCounter: null,
        serviceCompletedAt: new Date()
      }
    });

    io.emit('queue_update');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark No-Show" });
  }
});

/* Simulation and Testing */

app.post('/api/admin/simulate', authenticateToken, requireAdmin, async (req, res) => {
  const { flightId, count = 5 } = req.body;
  
  const getWeightedClass = () => {
    const r = Math.random();
    if (r < 0.7) return 'ECONOMY';
    if (r < 0.9) return 'BUSINESS';
    return 'FIRST';
  };

  try {
    const flight = await prisma.flight.findUnique({ where: { id: flightId } });
    if (!flight) return res.status(404).json({ error: "Flight not found for sim" });

    for (let i = 0; i < count; i++) {
      const ticketClass = getWeightedClass();
      const isSpecialNeeds = Math.random() > 0.85; 
      const botId = `bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const user = await prisma.user.create({
        data: {
          username: botId,
          email: `${botId}@simulation.com`,
          password: "demo", 
          name: `Passenger ${ticketClass.substring(0,3)}-${Math.floor(Math.random()*100)}`,
          role: 'PASSENGER'
        }
      });

      const score = calculatePriorityScore(
          ticketClass, 
          isSpecialNeeds, 
          new Date(),
          flight.departureTime
      );

      await prisma.queueEntry.create({
        data: {
          userId: user.id,
          flightId: flightId, 
          ticketClass,
          isSpecialNeeds,
          priorityScore: score,
          status: 'WAITING'
        }
      });
    }

    io.emit('queue_update');
    io.emit(`flight:${flightId}:update`);
    
    res.json({ success: true, message: `Generated ${count} passengers` });

  } catch (error) {
    console.error("Simulation failed:", error);
    res.status(500).json({ error: "Simulation failed" });
  }
});

app.post('/api/admin/reset', authenticateToken, requireAdmin, async (req, res) => {
  await prisma.queueEntry.deleteMany({});
  io.emit('queue_update');
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));