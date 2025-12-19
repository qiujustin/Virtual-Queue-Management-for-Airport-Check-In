const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // Clear existing data
  await prisma.queueEntry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.flight.deleteMany();

  // Create Admin User
  const hashedPassword = await bcrypt.hash("admin123", 10);
  
  const admin = await prisma.user.create({
    data: {
      name: "System Admin",
      username: "admin",
      email: "admin@airport.com",
      password: hashedPassword,
      role: "ADMIN"
    }
  });
  console.log(`Created Admin: ${admin.username}`);

  // Create Sample Flight
  const flight = await prisma.flight.create({
    data: {
      flightCode: "MH370",
      destination: "Beijing",
      departureTime: new Date(new Date().getTime() + 60 * 60 * 1000), // Departs in 1 hour
      status: "SCHEDULED"
    }
  });
  console.log(`Created Flight: ${flight.flightCode}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });