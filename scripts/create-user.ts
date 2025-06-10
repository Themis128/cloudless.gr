import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createRegularUser(email: string, password: string, name: string = 'Regular User') {
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

    // Create user with regular role
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'USER',
        isActive: true,
      },
    });

    console.log('Regular user created successfully:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error('Error creating regular user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Example usage:
// You can run this script with command line arguments
const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Please provide email and password');
  console.log('Usage: ts-node create-user.ts <email> <password> [name]');
  process.exit(1);
}

createRegularUser(email, password, name);
