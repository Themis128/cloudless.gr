// AI-Powered Chatbot Reference Project Creator
// This script creates a complete reference project with all components

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

console.log('🚀 Creating AI-Powered Chatbot Reference Project...');
console.log(`Base URL: ${BASE_URL}`);
console.log(`API Base: ${API_BASE}`);
console.log('');

// Function to make API calls
async function makeApiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    const url = `${API_BASE}${endpoint}`;
    
    try {
        console.log(`Making ${method} request to ${url}`);
        if (body) {
            console.log('Body:', JSON.stringify(body, null, 2));
        }
        
        const options = {
            method,
            headers,
            ...(body && { body: JSON.stringify(body) })
        };
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error making API call: ${error.message}`);
        throw error;
    }
}

// Main function to create the reference project
async function createReferenceProject() {
    try {
        // Step 1: Create the Project
        console.log('📋 Step 1: Creating AI-Powered Chatbot Project...');
        
        const projectData = {
            project_name: 'AI-Powered Chatbot',
            description: 'Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard.',
            slug: 'ai-powered-chatbot',
            overview: 'Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard.',
            status: 'active',
            category: 'machine-learning',
            featured: true
        };
        
        const project = await makeApiCall('/prisma/projects', 'POST', projectData);
        console.log('✅ Project created successfully!');
        console.log(`   Project ID: ${project.data.id}`);
        console.log(`   Project Name: ${project.data.project_name}`);
        const projectId = project.data.id;
        
        console.log('');
        
        // Step 2: Create the Customer Service Bot
        console.log('🤖 Step 2: Creating Customer Service Bot...');
        
        const botConfig = {
            name: 'Customer Service Assistant',
            description: 'AI-powered customer service chatbot with multi-language support and intelligent response generation',
            config: {
                model: 'gpt-4',
                temperature: 0.7,
                max_tokens: 1000,
                system_prompt: 'You are a helpful customer service assistant. You help customers with their inquiries, provide accurate information, and ensure customer satisfaction. You can handle multiple languages and provide empathetic responses.',
                features: [
                    'Multi-language support',
                    'Intent recognition',
                    'Sentiment analysis',
                    'Knowledge base integration',
                    'Escalation handling'
                ],
                languages: ['English', 'Spanish', 'French', 'German', 'Chinese'],
                response_templates: {
                    greeting: 'Hello! I\'m here to help you. How can I assist you today?',
                    escalation: 'I understand your concern. Let me connect you with a human representative who can better assist you.',
                    goodbye: 'Thank you for contacting us. Have a great day!'
                }
            },
            status: 'active'
        };
        
        const botData = {
            name: botConfig.name,
            description: botConfig.description,
            config: JSON.stringify(botConfig.config),
            status: botConfig.status
        };
        
        const bot = await makeApiCall('/prisma/bots', 'POST', botData);
        console.log('✅ Bot created successfully!');
        console.log(`   Bot ID: ${bot.data.id}`);
        console.log(`   Bot Name: ${bot.data.name}`);
        const botId = bot.data.id;
        
        console.log('');
        
        // Step 3: Create the Data Processing Pipeline
        console.log('🔧 Step 3: Creating Data Processing Pipeline...');
        
        const pipelineConfig = {
            name: 'Customer Data Processor',
            description: 'Pipeline for processing customer interactions, sentiment analysis, and data enrichment',
            config: {
                steps: [
                    {
                        name: 'Input Validation',
                        type: 'validator',
                        config: {
                            required_fields: ['customer_id', 'message', 'timestamp'],
                            data_types: {
                                customer_id: 'string',
                                message: 'string',
                                timestamp: 'datetime'
                            }
                        }
                    },
                    {
                        name: 'Language Detection',
                        type: 'language_detector',
                        config: {
                            supported_languages: ['en', 'es', 'fr', 'de', 'zh'],
                            confidence_threshold: 0.8
                        }
                    },
                    {
                        name: 'Sentiment Analysis',
                        type: 'sentiment_analyzer',
                        config: {
                            model: 'vader',
                            output_format: 'score',
                            threshold: {
                                positive: 0.1,
                                negative: -0.1
                            }
                        }
                    },
                    {
                        name: 'Intent Classification',
                        type: 'intent_classifier',
                        config: {
                            intents: [
                                'general_inquiry',
                                'technical_support',
                                'billing_question',
                                'complaint',
                                'praise',
                                'escalation_request'
                            ],
                            confidence_threshold: 0.7
                        }
                    },
                    {
                        name: 'Data Enrichment',
                        type: 'enricher',
                        config: {
                            enrichments: [
                                'customer_history',
                                'product_preferences',
                                'interaction_patterns'
                            ]
                        }
                    },
                    {
                        name: 'Response Generation',
                        type: 'response_generator',
                        config: {
                            use_sentiment: true,
                            use_intent: true,
                            use_history: true,
                            response_templates: true
                        }
                    }
                ],
                error_handling: {
                    retry_attempts: 3,
                    fallback_response: 'I apologize, but I\'m experiencing technical difficulties. Please try again or contact support.',
                    log_errors: true
                },
                performance: {
                    timeout_seconds: 30,
                    max_concurrent_requests: 100,
                    cache_responses: true
                }
            },
            status: 'active'
        };
        
        const pipelineData = {
            name: pipelineConfig.name,
            description: pipelineConfig.description,
            config: JSON.stringify(pipelineConfig.config),
            status: pipelineConfig.status
        };
        
        const pipeline = await makeApiCall('/prisma/pipelines', 'POST', pipelineData);
        console.log('✅ Pipeline created successfully!');
        console.log(`   Pipeline ID: ${pipeline.data.id}`);
        console.log(`   Pipeline Name: ${pipeline.data.name}`);
        const pipelineId = pipeline.data.id;
        
        console.log('');
        
        // Step 4: Create Analytics Dashboard Configuration
        console.log('📊 Step 4: Creating Analytics Dashboard Configuration...');
        
        const analyticsConfig = {
            name: 'Customer Analytics Dashboard',
            description: 'Real-time analytics dashboard for monitoring customer interactions and bot performance',
            config: {
                metrics: [
                    {
                        name: 'Total Interactions',
                        type: 'counter',
                        query: 'SELECT COUNT(*) FROM interactions WHERE DATE(created_at) = CURDATE()',
                        refresh_interval: 60
                    },
                    {
                        name: 'Average Response Time',
                        type: 'gauge',
                        query: 'SELECT AVG(response_time) FROM interactions WHERE DATE(created_at) = CURDATE()',
                        refresh_interval: 60
                    },
                    {
                        name: 'Customer Satisfaction',
                        type: 'percentage',
                        query: 'SELECT (COUNT(CASE WHEN sentiment_score > 0.1 THEN 1 END) * 100.0 / COUNT(*)) FROM interactions WHERE DATE(created_at) = CURDATE()',
                        refresh_interval: 300
                    },
                    {
                        name: 'Top Intents',
                        type: 'bar_chart',
                        query: 'SELECT intent, COUNT(*) as count FROM interactions WHERE DATE(created_at) = CURDATE() GROUP BY intent ORDER BY count DESC LIMIT 5',
                        refresh_interval: 300
                    },
                    {
                        name: 'Language Distribution',
                        type: 'pie_chart',
                        query: 'SELECT language, COUNT(*) as count FROM interactions WHERE DATE(created_at) = CURDATE() GROUP BY language',
                        refresh_interval: 600
                    }
                ],
                alerts: [
                    {
                        name: 'High Response Time',
                        condition: 'response_time > 10',
                        threshold: 10,
                        action: 'send_notification'
                    },
                    {
                        name: 'Low Satisfaction',
                        condition: 'satisfaction_score < 0.6',
                        threshold: 0.6,
                        action: 'escalate_to_supervisor'
                    },
                    {
                        name: 'High Error Rate',
                        condition: 'error_rate > 0.05',
                        threshold: 0.05,
                        action: 'restart_service'
                    }
                ],
                dashboard_layout: {
                    theme: 'light',
                    refresh_rate: 30,
                    auto_refresh: true,
                    export_enabled: true
                }
            },
            status: 'active'
        };
        
        const analyticsData = {
            name: analyticsConfig.name,
            description: analyticsConfig.description,
            config: JSON.stringify(analyticsConfig.config),
            status: analyticsConfig.status
        };
        
        const analytics = await makeApiCall('/prisma/pipelines', 'POST', analyticsData);
        console.log('✅ Analytics Dashboard created successfully!');
        console.log(`   Analytics ID: ${analytics.data.id}`);
        console.log(`   Analytics Name: ${analytics.data.name}`);
        const analyticsId = analytics.data.id;
        
        console.log('');
        
        // Step 5: Summary
        console.log('🎉 Reference Project Creation Complete!');
        console.log('================================================');
        console.log('');
        console.log('📋 Project Details:');
        console.log('   Name: AI-Powered Chatbot');
        console.log(`   ID: ${projectId}`);
        console.log('   Status: Active');
        console.log('');
        console.log('🤖 Bot Components:');
        console.log(`   Customer Service Assistant (ID: ${botId})`);
        console.log('   - Multi-language support');
        console.log('   - Intent recognition');
        console.log('   - Sentiment analysis');
        console.log('');
        console.log('🔧 Pipeline Components:');
        console.log(`   Customer Data Processor (ID: ${pipelineId})`);
        console.log('   - 6 processing steps');
        console.log('   - Error handling');
        console.log('   - Performance optimization');
        console.log('');
        console.log(`📊 Analytics Dashboard (ID: ${analyticsId})`);
        console.log('   - Real-time metrics');
        console.log('   - Automated alerts');
        console.log('   - Export capabilities');
        console.log('');
        console.log('🌐 Access your project at:');
        console.log(`   ${BASE_URL}/projects/${projectId}`);
        console.log('');
        console.log('✨ Reference project ready for demonstration!');
        
        return {
            projectId,
            botId,
            pipelineId,
            analyticsId
        };
        
    } catch (error) {
        console.error('❌ Failed to create reference project:', error.message);
        process.exit(1);
    }
}

// Run the script if called directly
if (typeof require !== 'undefined' && require.main === module) {
    createReferenceProject();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createReferenceProject };
} 