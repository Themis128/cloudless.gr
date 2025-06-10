import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { dirname } from 'path';

// CommonJS compatibility
const __dirname = dirname(__filename);

const prisma = new PrismaClient({
  log: ['error', 'warn', 'info'],
});

async function createAdminUser(email: string, password: string, name: string = 'Admin User') {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.error('User with this email already exists');
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with admin role
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        emailVerified: new Date(), // Admin users are pre-verified
        isActive: true,
      },
    });

    console.log('Admin user created successfully:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Example usage:
// You can run this script with command line arguments
const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Please provide email and password');
  console.log('Usage: ts-node create-admin.ts <email> <password> [name]');
  process.exit(1);
}

// Run the function and handle any unhandled promise rejections
createAdminUser(email, password, name).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
