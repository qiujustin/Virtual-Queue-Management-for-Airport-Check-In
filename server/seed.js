const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // Uses the library you installed
const prisma = new PrismaClient();

async function main() {
  // Hash a default password ('password123')
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Create a Test Flight
  const flight = await prisma.flight.upsert({
    where: { id: 'flight-uuid-placeholder' },
    update: {},
    create: {
      id: 'flight-uuid-placeholder',
      flightCode: 'MH370',
      destination: 'Beijing',
      departureTime: new Date('2025-12-25T10:00:00Z'),
    },
  });
  console.log('✅ Test Flight Created');

  // 2. Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@airport.com' },
    update: { password: hashedPassword }, // Update password if exists
    create: {
      email: 'admin@airport.com',
      username: 'admin',
      name: 'Admin1',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin User Created (Pass: password123)');
  
  // 3. Create Passenger User
  const passenger = await prisma.user.upsert({
    where: { email: 'passenger@gmail.com' },
    update: { password: hashedPassword },
    create: {
      id: 'user-uuid-placeholder',
      email: 'passenger@gmail.com',
      username: 'passenger',
      name: 'Justin Qiu',
      password: hashedPassword,
      role: 'PASSENGER',
    },
  });
  console.log('✅ Test Passenger Created (Pass: password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });