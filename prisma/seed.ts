import { PrismaClient, ProjectType, ProjectStatus, TrainingStatus } from '../generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create sample profiles
  const johnProfile = await prisma.profile.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: {
      email: 'john.doe@example.com',
      username: 'johndoe',
      first_name: 'John',
      last_name: 'Doe',
      full_name: 'John Doe',
      role: 'admin',
      is_active: true,
      email_verified: true,
      bio: 'AI/ML Engineer with 5+ years of experience in deep learning and computer vision.',
      location: 'San Francisco, CA',
      website: 'https://johndoe.dev'
    }
  })

  const janeProfile = await prisma.profile.upsert({
    where: { email: 'jane.smith@example.com' },
    update: {},
    create: {
      email: 'jane.smith@example.com',
      username: 'janesmith',
      first_name: 'Jane',
      last_name: 'Smith',
      full_name: 'Jane Smith',
      role: 'user',
      is_active: true,
      email_verified: true,
      bio: 'Data scientist passionate about NLP and machine learning applications.',
      location: 'New York, NY'
    }
  })

  console.log(`✅ Created profiles: ${johnProfile.username}, ${janeProfile.username}`)

  // Create sample projects
  const imageClassificationProject = await prisma.project.create({
    data: {
      name: 'Image Classification Model',
      description: 'A deep learning model for classifying images into different categories using convolutional neural networks.',
      type: ProjectType.cv,
      framework: 'PyTorch',
      status: ProjectStatus.active,
      owner_id: johnProfile.id,
      config: {
        model_architecture: 'ResNet50',
        input_size: [224, 224, 3],
        num_classes: 10,
        optimizer: 'Adam',
        loss_function: 'CrossEntropyLoss'
      }
    }
  })

  const nlpProject = await prisma.project.create({
    data: {
      name: 'Sentiment Analysis API',
      description: 'Natural language processing model for analyzing sentiment in customer reviews and social media posts.',
      type: ProjectType.nlp,
      framework: 'TensorFlow',
      status: ProjectStatus.training,
      owner_id: janeProfile.id,
      config: {
        model_type: 'BERT',
        max_sequence_length: 512,
        num_labels: 3,
        learning_rate: 2e-5
      }
    }
  })

  const recommendationProject = await prisma.project.create({
    data: {
      name: 'Movie Recommendation System',
      description: 'Collaborative filtering system for recommending movies based on user preferences and behavior.',
      type: ProjectType.recommendation,
      framework: 'Scikit-learn',
      status: ProjectStatus.deployed,
      owner_id: johnProfile.id,
      config: {
        algorithm: 'matrix_factorization',
        num_factors: 50,
        regularization: 0.01
      }
    }
  })

  console.log(`✅ Created projects: ${imageClassificationProject.name}, ${nlpProject.name}, ${recommendationProject.name}`)

  // Add collaborator to one project
  await prisma.projectCollaborator.create({
    data: {
      project_id: imageClassificationProject.id,
      user_id: janeProfile.id,
      role: 'contributor',
      invited_at: new Date(),
      accepted_at: new Date()
    }
  })

  // Create training sessions
  const completedTraining = await prisma.trainingSession.create({
    data: {
      name: 'ResNet50 Training v1.0',
      project_id: imageClassificationProject.id,
      status: TrainingStatus.completed,
      config: {
        epochs: 50,
        batch_size: 32,
        learning_rate: 0.001,
        base_model: 'ResNet50'
      },
      metrics: {
        final_accuracy: 0.94,
        final_loss: 0.18,
        training_time: 3600,
        best_epoch: 42
      },
      started_at: new Date(Date.now() - 86400000), // 1 day ago
      completed_at: new Date(Date.now() - 82800000) // 23 hours ago
    }
  })

  const runningTraining = await prisma.trainingSession.create({
    data: {
      name: 'BERT Fine-tuning v2.1',
      project_id: nlpProject.id,
      status: TrainingStatus.running,
      config: {
        epochs: 10,
        batch_size: 16,
        learning_rate: 2e-5,
        base_model: 'bert-base-uncased'
      },
      started_at: new Date(Date.now() - 7200000) // 2 hours ago
    }
  })

  console.log(`✅ Created training sessions: ${completedTraining.name}, ${runningTraining.name}`)

  // Create model versions
  await prisma.modelVersion.create({
    data: {
      version: '1.0.0',
      project_id: imageClassificationProject.id,
      training_session_id: completedTraining.id,
      model_path: '/models/image_classifier_v1.0.0.pth',
      is_deployed: true,
      metrics: {
        accuracy: 0.94,
        precision: 0.93,
        recall: 0.95,
        f1_score: 0.94,
        model_size_mb: 102.5
      }
    }
  })

  await prisma.modelVersion.create({
    data: {
      version: '0.8.0',
      project_id: imageClassificationProject.id,
      training_session_id: completedTraining.id,
      model_path: '/models/image_classifier_v0.8.0.pth',
      is_deployed: false,
      metrics: {
        accuracy: 0.89,
        precision: 0.87,
        recall: 0.91,
        f1_score: 0.89,
        model_size_mb: 98.2
      }
    }
  })

  // Create some bots
  await prisma.bot.create({
    data: {
      name: 'ML Assistant',
      model: 'gpt-4',
      prompt: 'You are an AI assistant specialized in machine learning and data science. Help users with their ML projects, explain concepts, and provide code examples.',
      tools: JSON.stringify(['code_execution', 'data_analysis', 'visualization']),
      memory: JSON.stringify({ context_length: 8000, conversation_history: true })
    }
  })

  await prisma.bot.create({
    data: {
      name: 'Code Reviewer',
      model: 'claude-3-sonnet',
      prompt: 'You are a senior software engineer who reviews code for quality, security, and best practices. Provide constructive feedback and suggestions.',
      tools: JSON.stringify(['code_analysis', 'security_scan', 'performance_check']),
      memory: JSON.stringify({ context_length: 16000, conversation_history: false })
    }
  })

  // Create some sample todos
  await prisma.todo.createMany({
    data: [
      { title: 'Review model performance metrics', is_complete: false },
      { title: 'Update training documentation', is_complete: true },
      { title: 'Implement data validation pipeline', is_complete: false },
      { title: 'Deploy model to staging environment', is_complete: false },
      { title: 'Set up monitoring and alerting', is_complete: true }
    ]
  })

  // Create analytics pipeline
  const analyticsPipeline = await prisma.analyticsPipeline.create({
    data: {
      name: 'Model Performance Analytics',
      description: 'Pipeline for analyzing model performance metrics and generating reports',
      owner_id: johnProfile.id,
      project_id: imageClassificationProject.id,
      config: {
        schedule: 'daily',
        metrics: ['accuracy', 'latency', 'throughput'],
        alerts: {
          accuracy_threshold: 0.85,
          latency_threshold: 100
        }
      },
      status: 'active',
      version: '1.2.0'
    }
  })

  // Create analytics steps
  await prisma.analyticsStep.createMany({
    data: [
      {
        pipeline_id: analyticsPipeline.id,
        step_type: 'data_extraction',
        order_index: 1,
        config: {
          source: 'model_logs',
          time_range: '24h',
          filters: { status: 'completed' }
        }
      },
      {
        pipeline_id: analyticsPipeline.id,
        step_type: 'metric_calculation',
        order_index: 2,
        config: {
          metrics: ['accuracy', 'precision', 'recall'],
          aggregation: 'mean'
        }
      },
      {
        pipeline_id: analyticsPipeline.id,
        step_type: 'report_generation',
        order_index: 3,
        config: {
          format: 'json',
          destination: 's3://analytics-reports/',
          notification: true
        }
      }
    ]
  })

  console.log(`✅ Created analytics pipeline: ${analyticsPipeline.name}`)

  // Create some contact messages
  await prisma.contactMessage.createMany({
    data: [
      {
        first_name: 'Alice',
        last_name: 'Johnson',
        email: 'alice.johnson@company.com',
        company: 'TechCorp Inc.',
        job_title: 'Data Scientist',
        subject: 'Enterprise ML Platform Inquiry',
        message: 'Hi, we are interested in your enterprise ML platform for our team of 50+ data scientists. Could you provide more information about pricing and features?',
        priority: 'high',
        status: 'new'
      },
      {
        first_name: 'Bob',
        last_name: 'Wilson',
        email: 'bob.wilson@startup.io',
        subject: 'API Integration Question',
        message: 'I am trying to integrate your API with our application but running into authentication issues. Can someone help?',
        priority: 'medium',
        status: 'in_progress',
        assigned_to: johnProfile.id
      }
    ]
  })

  console.log('✅ Created sample contact messages')

  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })