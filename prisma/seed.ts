import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Clear existing data
  await prisma.testimonial.deleteMany()
  await prisma.projectImage.deleteMany()
  await prisma.projectTag.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  // Create users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@cloudless.gr',
      password: '$2b$10$h1Acoo6qEPGFAu2Qf9p4uejUHTwBXfL1Pm3AH0vnO2ICQoFhMTF4.', // Admin123!
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      isVerified: true,
    },
  })

  const regularUser = await prisma.user.create({
    data: {
      email: 'user@cloudless.gr',
      password: '$2b$10$h1Acoo6qEPGFAu2Qf9p4uejUHTwBXfL1Pm3AH0vnO2ICQoFhMTF4.', // Admin123!
      name: 'Regular User',
      role: 'user',
      isActive: true,
      isVerified: true,
    },
  })

  console.log('✅ Users created')

  // Create projects
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        project_name: 'E-Commerce Platform',
        slug: 'ecommerce-platform',
        overview: 'A modern e-commerce platform built with Vue.js and Node.js',
        description:
          'Full-stack e-commerce solution with payment integration, inventory management, and admin dashboard.',
        status: 'published',
        category: 'web-development',
        live_url: 'https://ecommerce-demo.cloudless.gr',
        github_url: 'https://github.com/cloudless/ecommerce',
        featured: true,
        completionDate: '2024-01-15',
        duration: '3 months',
        teamSize: 4,
        userId: adminUser.id,
      },
    }),
    prisma.project.create({
      data: {
        project_name: 'Mobile Banking App',
        slug: 'mobile-banking-app',
        overview: 'Secure mobile banking application for iOS and Android',
        description:
          'Cross-platform mobile app with biometric authentication, real-time transactions, and financial analytics.',
        status: 'published',
        category: 'mobile-app',
        live_url: 'https://banking-app.cloudless.gr',
        github_url: 'https://github.com/cloudless/banking-app',
        featured: true,
        completionDate: '2024-03-20',
        duration: '6 months',
        teamSize: 6,
        userId: adminUser.id,
      },
    }),
    prisma.project.create({
      data: {
        project_name: 'AI-Powered Chatbot',
        slug: 'ai-chatbot',
        overview: 'Intelligent chatbot using natural language processing',
        description:
          'Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard.',
        status: 'published',
        category: 'ai-ml',
        live_url: 'https://chatbot-demo.cloudless.gr',
        github_url: 'https://github.com/cloudless/ai-chatbot',
        featured: false,
        completionDate: '2024-02-10',
        duration: '2 months',
        teamSize: 3,
        userId: regularUser.id,
      },
    }),
  ])

  console.log('✅ Projects created')

  // Create project tags
  const tags = [
    { name: 'Vue.js', color: '#4FC08D', primary: true },
    { name: 'Node.js', color: '#339933', primary: true },
    { name: 'TypeScript', color: '#3178C6', primary: false },
    { name: 'React Native', color: '#61DAFB', primary: true },
    { name: 'Python', color: '#3776AB', primary: true },
    { name: 'TensorFlow', color: '#FF6F00', primary: false },
    { name: 'PostgreSQL', color: '#336791', primary: false },
    { name: 'Redis', color: '#DC382D', primary: false },
    { name: 'Docker', color: '#2496ED', primary: false },
    { name: 'AWS', color: '#FF9900', primary: false },
  ]

  for (const tag of tags) {
    await prisma.projectTag.create({
      data: tag,
    })
  }

  console.log('✅ Tags created')

  // Create project images
  const images = [
    {
      projectId: projects[0].id,
      img_name: 'E-commerce Dashboard',
      img_url: '/images/ecommerce-dashboard.jpg',
      is_thumbnail: true,
      alt: 'E-commerce platform dashboard',
      order: 0,
    },
    {
      projectId: projects[0].id,
      img_name: 'E-commerce Mobile',
      img_url: '/images/ecommerce-mobile.jpg',
      is_thumbnail: false,
      alt: 'E-commerce mobile view',
      order: 1,
    },
    {
      projectId: projects[1].id,
      img_name: 'Banking App Login',
      img_url: '/images/banking-login.jpg',
      is_thumbnail: true,
      alt: 'Mobile banking app login screen',
      order: 0,
    },
    {
      projectId: projects[1].id,
      img_name: 'Banking Dashboard',
      img_url: '/images/banking-dashboard.jpg',
      is_thumbnail: false,
      alt: 'Banking app dashboard',
      order: 1,
    },
    {
      projectId: projects[2].id,
      img_name: 'AI Chatbot Interface',
      img_url: '/images/chatbot-interface.jpg',
      is_thumbnail: true,
      alt: 'AI chatbot conversation interface',
      order: 0,
    },
  ]

  for (const image of images) {
    await prisma.projectImage.create({
      data: image,
    })
  }

  console.log('✅ Project images created')

  // Create testimonials
  const testimonials = [
    {
      quote:
        'Exceptional work on our e-commerce platform. The team delivered exactly what we needed and more.',
      author: 'Sarah Johnson',
      position: 'CEO',
      company: 'TechCorp',
      rating: 5,
    },
    {
      quote:
        'The mobile banking app exceeded our expectations. Security and user experience are top-notch.',
      author: 'Michael Chen',
      position: 'CTO',
      company: 'FinTech Solutions',
      rating: 5,
    },
    {
      quote:
        'The AI chatbot has transformed our customer service. Response times improved by 80%.',
      author: 'Emily Rodriguez',
      position: 'Customer Success Manager',
      company: 'ServicePro',
      rating: 5,
    },
    {
      quote:
        'Professional, reliable, and innovative. Highly recommend for any tech project.',
      author: 'David Kim',
      position: 'Product Manager',
      company: 'InnovateLab',
      rating: 5,
    },
  ]

  for (const project of projects) {
    const testimonial =
      testimonials[Math.floor(Math.random() * testimonials.length)]
    await prisma.testimonial.create({
      data: {
        quote: testimonial.quote,
        author: testimonial.author,
        position: testimonial.position,
        company: testimonial.company,
        rating: testimonial.rating,
        projectId: project.id,
      },
    })
  }

  console.log('✅ Testimonials created')

  // Seed Todos
  await prisma.todo.createMany({
    data: [
      { title: 'Buy groceries', is_complete: false },
      { title: 'Finish Nuxt project', is_complete: false },
      { title: 'Read Redis docs', is_complete: true },
      { title: 'Update Prisma schema', is_complete: true },
    ],
  })
  console.log('✅ Todos created')

  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch(e => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
