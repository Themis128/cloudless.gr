# 🚀 Cloudless Wizard API Integration Guide

## Overview

The Cloudless Wizard API provides comprehensive access to AI-powered cloud solutions, including bot management, model training, data pipelines, and analytics. This guide will help you integrate the API into your applications.

## 🔗 Base URL

```
Development: http://localhost:3000/api/v1
Production: https://your-domain.com/api/v1
```

## 🔐 Authentication

All API requests require a Bearer token in the Authorization header:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

### Getting an Access Token

1. **Register a new account:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Your Company"
  }'
```

2. **Login to get access token:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-uuid",
      "email": "your-email@example.com"
    },
    "expiresIn": "24h"
  }
}
```

## 🤖 Bot Management

### List All Bots

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/bots?page=1&limit=10&status=active"
```

### Create a New Bot

```bash
curl -X POST http://localhost:3000/api/v1/bots \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Support Bot",
    "type": "customer-support",
    "description": "AI-powered customer support assistant",
    "configuration": {
      "language": "en",
      "tone": "professional"
    }
  }'
```

### Chat with a Bot

```bash
curl -X POST http://localhost:3000/api/v1/bots/BOT_ID/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, I need help with my order",
    "context": {
      "userId": "customer-123",
      "orderId": "order-456"
    },
    "sessionId": "session-789"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "response": "Hello! I'm here to help you with your order. Can you please provide your order number?",
    "sessionId": "session-789",
    "bot": {
      "id": "bot-uuid",
      "name": "Customer Support Bot",
      "type": "customer-support"
    },
    "timestamp": "2025-07-20T10:55:53.595Z"
  }
}
```

## 🧠 Model Management

### List All Models

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/models"
```

### Create a New Model

```bash
curl -X POST http://localhost:3000/api/v1/models \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Text Classification Model",
    "type": "text-classification",
    "description": "Model for classifying customer feedback",
    "configuration": {
      "algorithm": "bert",
      "maxLength": 512
    }
  }'
```

### Train a Model

```bash
curl -X POST http://localhost:3000/api/v1/models/MODEL_ID/train \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "training-data.csv",
    "parameters": {
      "epochs": 10,
      "batchSize": 32,
      "learningRate": 0.001
    }
  }'
```

### Make Predictions

```bash
curl -X POST http://localhost:3000/api/v1/models/MODEL_ID/predict \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "This product is amazing!",
    "options": {
      "returnProbabilities": true
    }
  }'
```

## 🔄 Pipeline Management

### List All Pipelines

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/pipelines"
```

### Create a New Pipeline

```bash
curl -X POST http://localhost:3000/api/v1/pipelines \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Data Processing Pipeline",
    "description": "Process customer data for analysis",
    "steps": [
      {
        "type": "data_ingestion",
        "config": {
          "source": "database",
          "query": "SELECT * FROM customers"
        }
      },
      {
        "type": "data_cleaning",
        "config": {
          "removeDuplicates": true,
          "fillMissing": "mean"
        }
      }
    ]
  }'
```

### Execute a Pipeline

```bash
curl -X POST http://localhost:3000/api/v1/pipelines/PIPELINE_ID/run \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "data": "your-data-here",
      "parameters": {
        "batchSize": 1000
      }
    }
  }'
```

## 📊 Analytics

### Get Dashboard Analytics

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/analytics/dashboard?period=30d&projectId=PROJECT_ID"
```

Response:
```json
{
  "success": true,
  "data": {
    "metrics": {
      "bots": {
        "total": 5,
        "active": 3,
        "draft": 2,
        "byType": {
          "customer-support": 2,
          "developer-assistant": 1,
          "data-analyst": 1,
          "content-writer": 1
        }
      },
      "conversations": {
        "total": 1250,
        "today": 45,
        "thisWeek": 320
      },
      "models": {
        "total": 8,
        "trained": 6,
        "training": 1
      },
      "pipelines": {
        "total": 12,
        "active": 8,
        "completed": 4
      }
    },
    "usageTrends": {
      "daily": [
        {"date": "2025-07-14", "count": 45},
        {"date": "2025-07-15", "count": 52}
      ]
    },
    "performance": {
      "averageResponseTime": 1.2,
      "uptime": 99.9,
      "errorRate": 0.1,
      "userSatisfaction": 4.5
    }
  }
}
```

## 🔗 Webhooks

### Register a Webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/register \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/cloudless",
    "events": [
      "bot.created",
      "bot.deployed",
      "conversation.created",
      "model.trained"
    ],
    "description": "Webhook for real-time notifications",
    "secret": "your-webhook-secret"
  }'
```

### Webhook Event Format

When events occur, your webhook endpoint will receive POST requests with this format:

```json
{
  "event": "bot.created",
  "data": {
    "bot": {
      "id": "bot-uuid",
      "name": "New Bot",
      "type": "customer-support"
    },
    "user": {
      "id": "user-uuid",
      "email": "user@example.com"
    }
  },
  "timestamp": "2025-07-20T10:55:53.595Z",
  "signature": "sha256=..."
}
```

**Available Events:**
- `bot.created` - New bot created
- `bot.updated` - Bot configuration updated
- `bot.deleted` - Bot deleted
- `bot.deployed` - Bot deployed to production
- `conversation.created` - New conversation started
- `model.trained` - Model training completed
- `pipeline.completed` - Pipeline execution completed
- `project.created` - New project created
- `project.updated` - Project updated

## 📚 API Documentation

### OpenAPI Specification

Access the complete OpenAPI specification:

```bash
curl http://localhost:3000/api/v1/docs
```

### API Index

Get an overview of all available endpoints:

```bash
curl http://localhost:3000/api/v1
```

## 🛠️ SDK Examples

### JavaScript/Node.js

```javascript
class CloudlessAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // Bot methods
  async listBots(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/bots?${query}`);
  }

  async createBot(botData) {
    return this.request('/bots', {
      method: 'POST',
      body: JSON.stringify(botData)
    });
  }

  async chatWithBot(botId, message, context = {}) {
    return this.request(`/bots/${botId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, context })
    });
  }

  // Analytics methods
  async getAnalytics(period = '7d', projectId = null) {
    const params = { period };
    if (projectId) params.projectId = projectId;
    const query = new URLSearchParams(params).toString();
    return this.request(`/analytics/dashboard?${query}`);
  }
}

// Usage
const api = new CloudlessAPI('http://localhost:3000/api/v1', 'your-token');

// List bots
const bots = await api.listBots({ status: 'active' });

// Create a bot
const newBot = await api.createBot({
  name: 'My Bot',
  type: 'customer-support'
});

// Chat with bot
const response = await api.chatWithBot(newBot.data.bot.id, 'Hello!');

// Get analytics
const analytics = await api.getAnalytics('30d');
```

### Python

```python
import requests
import json

class CloudlessAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def request(self, endpoint, method='GET', data=None):
        url = f"{self.base_url}{endpoint}"
        response = requests.request(
            method=method,
            url=url,
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()

    def list_bots(self, **params):
        query = '&'.join([f"{k}={v}" for k, v in params.items()])
        return self.request(f'/bots?{query}')

    def create_bot(self, bot_data):
        return self.request('/bots', method='POST', data=bot_data)

    def chat_with_bot(self, bot_id, message, context=None):
        data = {'message': message}
        if context:
            data['context'] = context
        return self.request(f'/bots/{bot_id}/chat', method='POST', data=data)

    def get_analytics(self, period='7d', project_id=None):
        params = {'period': period}
        if project_id:
            params['projectId'] = project_id
        query = '&'.join([f"{k}={v}" for k, v in params.items()])
        return self.request(f'/analytics/dashboard?{query}')

# Usage
api = CloudlessAPI('http://localhost:3000/api/v1', 'your-token')

# List bots
bots = api.list_bots(status='active')

# Create a bot
new_bot = api.create_bot({
    'name': 'My Bot',
    'type': 'customer-support'
})

# Chat with bot
response = api.chat_with_bot(new_bot['data']['bot']['id'], 'Hello!')

# Get analytics
analytics = api.get_analytics(period='30d')
```

## 🔒 Security Best Practices

1. **Store tokens securely** - Never commit tokens to version control
2. **Use HTTPS** - Always use HTTPS in production
3. **Validate webhook signatures** - Verify webhook authenticity
4. **Rate limiting** - Respect API rate limits
5. **Error handling** - Implement proper error handling

## 📞 Support

- **Documentation**: `/api/v1/docs`
- **API Status**: `/api/v1/system/health`
- **Support Email**: support@cloudless.wizard
- **Community**: https://community.cloudless.wizard

## 🚀 Getting Started Checklist

- [ ] Register an account and get API token
- [ ] Test authentication with login endpoint
- [ ] Create your first bot
- [ ] Test bot chat functionality
- [ ] Set up webhooks for real-time notifications
- [ ] Implement analytics tracking
- [ ] Add error handling and retry logic
- [ ] Set up monitoring and alerting

---

**Happy integrating! 🎉**

For more examples and advanced usage, check out our [GitHub repository](https://github.com/cloudless-wizard/api-examples). 