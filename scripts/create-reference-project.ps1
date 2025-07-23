# AI-Powered Chatbot Reference Project Creator
# This script creates a complete reference project with all components

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$ApiBase = "http://localhost:3000/api"
)

Write-Host "🚀 Creating AI-Powered Chatbot Reference Project..." -ForegroundColor Green
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "API Base: $ApiBase" -ForegroundColor Yellow
Write-Host ""

# Function to make API calls
function Invoke-ApiCall {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    $uri = "$ApiBase$Endpoint"
    
    try {
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            Write-Host "Making $Method request to $uri" -ForegroundColor Cyan
            Write-Host "Body: $jsonBody" -ForegroundColor Gray
            
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $jsonBody
        } else {
            Write-Host "Making $Method request to $uri" -ForegroundColor Cyan
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
        }
        
        return $response
    }
    catch {
        Write-Host "Error making API call: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Red
        }
        throw
    }
}

# Step 1: Create the Project
Write-Host "📋 Step 1: Creating AI-Powered Chatbot Project..." -ForegroundColor Blue

$projectData = @{
    project_name = "AI-Powered Chatbot"
    description = "Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard."
    slug = "ai-powered-chatbot"
    overview = "Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard."
    status = "active"
    category = "machine-learning"
    featured = $true
}

try {
    $project = Invoke-ApiCall -Endpoint "/prisma/projects" -Method "POST" -Body $projectData
    Write-Host "✅ Project created successfully!" -ForegroundColor Green
    Write-Host "   Project ID: $($project.data.id)" -ForegroundColor Yellow
    Write-Host "   Project Name: $($project.data.project_name)" -ForegroundColor Yellow
    $projectId = $project.data.id
}
catch {
    Write-Host "❌ Failed to create project: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Create the Customer Service Bot
Write-Host "🤖 Step 2: Creating Customer Service Bot..." -ForegroundColor Blue

$botConfig = @{
    name = "Customer Service Assistant"
    description = "AI-powered customer service chatbot with multi-language support and intelligent response generation"
    config = @{
        model = "gpt-4"
        temperature = 0.7
        max_tokens = 1000
        system_prompt = "You are a helpful customer service assistant. You help customers with their inquiries, provide accurate information, and ensure customer satisfaction. You can handle multiple languages and provide empathetic responses."
        features = @(
            "Multi-language support",
            "Intent recognition",
            "Sentiment analysis",
            "Knowledge base integration",
            "Escalation handling"
        )
        languages = @("English", "Spanish", "French", "German", "Chinese")
        response_templates = @{
            greeting = "Hello! I'm here to help you. How can I assist you today?"
            escalation = "I understand your concern. Let me connect you with a human representative who can better assist you."
            goodbye = "Thank you for contacting us. Have a great day!"
        }
    }
    status = "active"
}

try {
    $botData = @{
        name = $botConfig.name
        description = $botConfig.description
        config = ($botConfig.config | ConvertTo-Json -Depth 10)
        status = $botConfig.status
    }
    
    $bot = Invoke-ApiCall -Endpoint "/prisma/bots" -Method "POST" -Body $botData
    Write-Host "✅ Bot created successfully!" -ForegroundColor Green
    Write-Host "   Bot ID: $($bot.data.id)" -ForegroundColor Yellow
    Write-Host "   Bot Name: $($bot.data.name)" -ForegroundColor Yellow
    $botId = $bot.data.id
}
catch {
    Write-Host "❌ Failed to create bot: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Create the Data Processing Pipeline
Write-Host "🔧 Step 3: Creating Data Processing Pipeline..." -ForegroundColor Blue

$pipelineConfig = @{
    name = "Customer Data Processor"
    description = "Pipeline for processing customer interactions, sentiment analysis, and data enrichment"
    config = @{
        steps = @(
            @{
                name = "Input Validation"
                type = "validator"
                config = @{
                    required_fields = @("customer_id", "message", "timestamp")
                    data_types = @{
                        customer_id = "string"
                        message = "string"
                        timestamp = "datetime"
                    }
                }
            },
            @{
                name = "Language Detection"
                type = "language_detector"
                config = @{
                    supported_languages = @("en", "es", "fr", "de", "zh")
                    confidence_threshold = 0.8
                }
            },
            @{
                name = "Sentiment Analysis"
                type = "sentiment_analyzer"
                config = @{
                    model = "vader"
                    output_format = "score"
                    threshold = @{
                        positive = 0.1
                        negative = -0.1
                    }
                }
            },
            @{
                name = "Intent Classification"
                type = "intent_classifier"
                config = @{
                    intents = @(
                        "general_inquiry",
                        "technical_support",
                        "billing_question",
                        "complaint",
                        "praise",
                        "escalation_request"
                    )
                    confidence_threshold = 0.7
                }
            },
            @{
                name = "Data Enrichment"
                type = "enricher"
                config = @{
                    enrichments = @(
                        "customer_history",
                        "product_preferences",
                        "interaction_patterns"
                    )
                }
            },
            @{
                name = "Response Generation"
                type = "response_generator"
                config = @{
                    use_sentiment = $true
                    use_intent = $true
                    use_history = $true
                    response_templates = $true
                }
            }
        )
        error_handling = @{
            retry_attempts = 3
            fallback_response = "I apologize, but I'm experiencing technical difficulties. Please try again or contact support."
            log_errors = $true
        }
        performance = @{
            timeout_seconds = 30
            max_concurrent_requests = 100
            cache_responses = $true
        }
    }
    status = "active"
}

try {
    $pipelineData = @{
        name = $pipelineConfig.name
        description = $pipelineConfig.description
        config = ($pipelineConfig.config | ConvertTo-Json -Depth 10)
        status = $pipelineConfig.status
    }
    
    $pipeline = Invoke-ApiCall -Endpoint "/prisma/pipelines" -Method "POST" -Body $pipelineData
    Write-Host "✅ Pipeline created successfully!" -ForegroundColor Green
    Write-Host "   Pipeline ID: $($pipeline.data.id)" -ForegroundColor Yellow
    Write-Host "   Pipeline Name: $($pipeline.data.name)" -ForegroundColor Yellow
    $pipelineId = $pipeline.data.id
}
catch {
    Write-Host "❌ Failed to create pipeline: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Create Analytics Dashboard Configuration
Write-Host "📊 Step 4: Creating Analytics Dashboard Configuration..." -ForegroundColor Blue

$analyticsConfig = @{
    name = "Customer Analytics Dashboard"
    description = "Real-time analytics dashboard for monitoring customer interactions and bot performance"
    config = @{
        metrics = @(
            @{
                name = "Total Interactions"
                type = "counter"
                query = "SELECT COUNT(*) FROM interactions WHERE DATE(created_at) = CURDATE()"
                refresh_interval = 60
            },
            @{
                name = "Average Response Time"
                type = "gauge"
                query = "SELECT AVG(response_time) FROM interactions WHERE DATE(created_at) = CURDATE()"
                refresh_interval = 60
            },
            @{
                name = "Customer Satisfaction"
                type = "percentage"
                query = "SELECT (COUNT(CASE WHEN sentiment_score > 0.1 THEN 1 END) * 100.0 / COUNT(*)) FROM interactions WHERE DATE(created_at) = CURDATE()"
                refresh_interval = 300
            },
            @{
                name = "Top Intents"
                type = "bar_chart"
                query = "SELECT intent, COUNT(*) as count FROM interactions WHERE DATE(created_at) = CURDATE() GROUP BY intent ORDER BY count DESC LIMIT 5"
                refresh_interval = 300
            },
            @{
                name = "Language Distribution"
                type = "pie_chart"
                query = "SELECT language, COUNT(*) as count FROM interactions WHERE DATE(created_at) = CURDATE() GROUP BY language"
                refresh_interval = 600
            }
        )
        alerts = @(
            @{
                name = "High Response Time"
                condition = "response_time > 10"
                threshold = 10
                action = "send_notification"
            },
            @{
                name = "Low Satisfaction"
                condition = "satisfaction_score < 0.6"
                threshold = 0.6
                action = "escalate_to_supervisor"
            },
            @{
                name = "High Error Rate"
                condition = "error_rate > 0.05"
                threshold = 0.05
                action = "restart_service"
            }
        )
        dashboard_layout = @{
            theme = "light"
            refresh_rate = 30
            auto_refresh = $true
            export_enabled = $true
        }
    }
    status = "active"
}

try {
    $analyticsData = @{
        name = $analyticsConfig.name
        description = $analyticsConfig.description
        config = ($analyticsConfig.config | ConvertTo-Json -Depth 10)
        status = $analyticsConfig.status
    }
    
    $analytics = Invoke-ApiCall -Endpoint "/prisma/pipelines" -Method "POST" -Body $analyticsData
    Write-Host "✅ Analytics Dashboard created successfully!" -ForegroundColor Green
    Write-Host "   Analytics ID: $($analytics.data.id)" -ForegroundColor Yellow
    Write-Host "   Analytics Name: $($analytics.data.name)" -ForegroundColor Yellow
    $analyticsId = $analytics.data.id
}
catch {
    Write-Host "❌ Failed to create analytics dashboard: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 5: Summary
Write-Host "🎉 Reference Project Creation Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Project Details:" -ForegroundColor Yellow
Write-Host "   Name: AI-Powered Chatbot" -ForegroundColor White
Write-Host "   ID: $projectId" -ForegroundColor White
Write-Host "   Status: Active" -ForegroundColor White
Write-Host ""
Write-Host "🤖 Bot Components:" -ForegroundColor Yellow
Write-Host "   Customer Service Assistant (ID: $botId)" -ForegroundColor White
Write-Host "   - Multi-language support" -ForegroundColor Gray
Write-Host "   - Intent recognition" -ForegroundColor Gray
Write-Host "   - Sentiment analysis" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 Pipeline Components:" -ForegroundColor Yellow
Write-Host "   Customer Data Processor (ID: $pipelineId)" -ForegroundColor White
Write-Host "   - 6 processing steps" -ForegroundColor Gray
Write-Host "   - Error handling" -ForegroundColor Gray
Write-Host "   - Performance optimization" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Analytics Dashboard (ID: $analyticsId)" -ForegroundColor White
Write-Host "   - Real-time metrics" -ForegroundColor Gray
Write-Host "   - Automated alerts" -ForegroundColor Gray
Write-Host "   - Export capabilities" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Access your project at:" -ForegroundColor Yellow
Write-Host "   $BaseUrl/projects/$projectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ Reference project ready for demonstration!" -ForegroundColor Green 