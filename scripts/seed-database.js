const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...')
    
    // Create a sample user
    const user = await prisma.user.create({
      data: {
        email: 'admin@cloudless.gr',
        password: 'hashed_password123', // In real app, this would be properly hashed
        name: 'Admin User',
        role: 'admin'
      }
    })
    console.log('✅ Created user:', user.name)
    
    // Create sample projects
    const projects = await Promise.all([
      prisma.project.create({
        data: {
          project_name: 'E-commerce Platform',
          slug: 'ecommerce-platform',
          overview: 'A modern e-commerce solution',
          description: 'Full-stack e-commerce platform with React frontend and Node.js backend',
          status: 'published',
          category: 'web-development',
          featured: true,
          userId: user.id
        }
      }),
      prisma.project.create({
        data: {
          project_name: 'AI Chatbot',
          slug: 'ai-chatbot',
          overview: 'Intelligent customer service chatbot',
          description: 'Machine learning-powered chatbot for customer support',
          status: 'published',
          category: 'ai-ml',
          featured: true,
          userId: user.id
        }
      }),
      prisma.project.create({
        data: {
          project_name: 'Mobile App',
          slug: 'mobile-app',
          overview: 'Cross-platform mobile application',
          description: 'React Native app for iOS and Android',
          status: 'draft',
          category: 'mobile-app',
          featured: false,
          userId: user.id
        }
      })
    ])
    console.log('✅ Created projects:', projects.length)
    
    // Create sample bots
    const bots = await Promise.all([
      prisma.bot.create({
        data: {
          name: 'Customer Support Bot',
          description: 'Handles customer inquiries and support tickets',
          config: JSON.stringify({ model: 'gpt-4', temperature: 0.7 }),
          status: 'active',
          userId: user.id
        }
      }),
      prisma.bot.create({
        data: {
          name: 'Sales Assistant',
          description: 'Assists with sales and lead generation',
          config: JSON.stringify({ model: 'gpt-3.5-turbo', temperature: 0.8 }),
          status: 'draft',
          userId: user.id
        }
      })
    ])
    console.log('✅ Created bots:', bots.length)
    
    // Create sample models
    const models = await Promise.all([
      prisma.model.create({
        data: {
          name: 'Text Classification Model',
          description: 'Classifies customer feedback into categories',
          type: 'text-classification',
          config: JSON.stringify({ architecture: 'BERT', accuracy: 0.92 }),
          status: 'ready',
          userId: user.id
        }
      }),
      prisma.model.create({
        data: {
          name: 'Image Recognition Model',
          description: 'Recognizes objects in product images',
          type: 'computer-vision',
          config: JSON.stringify({ architecture: 'ResNet', accuracy: 0.89 }),
          status: 'training',
          userId: user.id
        }
      })
    ])
    console.log('✅ Created models:', models.length)
    
    // Create sample pipelines
    const pipelines = await Promise.all([
      prisma.pipeline.create({
        data: {
          name: 'Data Processing Pipeline',
          description: 'Processes and cleans customer data',
          config: JSON.stringify({ steps: ['validation', 'cleaning', 'transformation'] }),
          status: 'active',
          userId: user.id
        }
      }),
      prisma.pipeline.create({
        data: {
          name: 'ML Training Pipeline',
          description: 'Automated machine learning model training',
          config: JSON.stringify({ steps: ['data-prep', 'training', 'evaluation'] }),
          status: 'draft',
          userId: user.id
        }
      })
    ])
    console.log('✅ Created pipelines:', pipelines.length)
    
    console.log('🎉 Database seeding completed successfully!')
    
  } catch (error) {
    console.error('❌ Error seeding database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedDatabase() 