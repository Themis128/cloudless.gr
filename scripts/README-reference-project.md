# AI-Powered Chatbot Reference Project

This directory contains scripts to create a comprehensive reference project that demonstrates the full capabilities of the AI development platform.

## 🎯 What Gets Created

The reference project includes:

### 📋 Project: AI-Powered Chatbot
- **Name**: AI-Powered Chatbot
- **Description**: Customer service chatbot with machine learning capabilities, multi-language support, and analytics dashboard
- **Status**: Active
- **Category**: Machine Learning
- **Featured**: Yes

### 🤖 Bot: Customer Service Assistant
- **Name**: Customer Service Assistant
- **Model**: GPT-4
- **Features**:
  - Multi-language support (English, Spanish, French, German, Chinese)
  - Intent recognition
  - Sentiment analysis
  - Knowledge base integration
  - Escalation handling
- **Response Templates**: Greeting, escalation, and goodbye messages
- **Status**: Active

### 🔧 Pipeline: Customer Data Processor
- **Name**: Customer Data Processor
- **Steps** (6 total):
  1. **Input Validation** - Validates customer data format
  2. **Language Detection** - Detects message language
  3. **Sentiment Analysis** - Analyzes customer sentiment
  4. **Intent Classification** - Classifies customer intent
  5. **Data Enrichment** - Enriches with customer history
  6. **Response Generation** - Generates appropriate responses
- **Error Handling**: Retry logic and fallback responses
- **Performance**: Optimized for high throughput
- **Status**: Active

### 📊 Analytics Dashboard
- **Name**: Customer Analytics Dashboard
- **Metrics**:
  - Total Interactions (real-time counter)
  - Average Response Time (gauge)
  - Customer Satisfaction (percentage)
  - Top Intents (bar chart)
  - Language Distribution (pie chart)
- **Alerts**:
  - High Response Time (>10s)
  - Low Satisfaction (<60%)
  - High Error Rate (>5%)
- **Features**: Auto-refresh, export capabilities, light theme
- **Status**: Active

## 🚀 How to Run

### Option 1: PowerShell Script (Windows)
```powershell
# Navigate to the scripts directory
cd scripts

# Run the PowerShell script
.\create-reference-project.ps1

# Or with custom URLs
.\create-reference-project.ps1 -BaseUrl "http://192.168.0.23:3001" -ApiBase "http://192.168.0.23:3001/api"
```

### Option 2: JavaScript Script (Node.js)
```bash
# Navigate to the scripts directory
cd scripts

# Run the JavaScript script
node create-reference-project.js

# Or with custom environment variables
BASE_URL=http://192.168.0.23:3001 API_BASE=http://192.168.0.23:3001/api node create-reference-project.js
```

### Option 3: Browser Console
```javascript
// Copy the content of create-reference-project.js and run in browser console
// Make sure to update BASE_URL and API_BASE variables first
```

## 📊 Expected Output

When successful, you'll see output like this:

```
🚀 Creating AI-Powered Chatbot Reference Project...
Base URL: http://localhost:3000
API Base: http://localhost:3000/api

📋 Step 1: Creating AI-Powered Chatbot Project...
✅ Project created successfully!
   Project ID: 1
   Project Name: AI-Powered Chatbot

🤖 Step 2: Creating Customer Service Bot...
✅ Bot created successfully!
   Bot ID: 1
   Bot Name: Customer Service Assistant

🔧 Step 3: Creating Data Processing Pipeline...
✅ Pipeline created successfully!
   Pipeline ID: 1
   Pipeline Name: Customer Data Processor

📊 Step 4: Creating Analytics Dashboard Configuration...
✅ Analytics Dashboard created successfully!
   Analytics ID: 2
   Analytics Name: Customer Analytics Dashboard

🎉 Reference Project Creation Complete!
================================================

📋 Project Details:
   Name: AI-Powered Chatbot
   ID: 1
   Status: Active

🤖 Bot Components:
   Customer Service Assistant (ID: 1)
   - Multi-language support
   - Intent recognition
   - Sentiment analysis

🔧 Pipeline Components:
   Customer Data Processor (ID: 1)
   - 6 processing steps
   - Error handling
   - Performance optimization

📊 Analytics Dashboard (ID: 2)
   - Real-time metrics
   - Automated alerts
   - Export capabilities

🌐 Access your project at:
   http://localhost:3000/projects/1

✨ Reference project ready for demonstration!
```

## 🔧 Configuration

### Environment Variables
- `BASE_URL`: The base URL of your application (default: http://localhost:3000)
- `API_BASE`: The API base URL (default: http://localhost:3000/api)

### Customization
You can modify the scripts to:
- Change project names and descriptions
- Add more bot features
- Modify pipeline steps
- Add additional analytics metrics
- Change response templates

## 🎯 Use Cases

This reference project is perfect for:

1. **Demonstrations** - Show the full capabilities of the platform
2. **Testing** - Verify all components work together
3. **Learning** - Understand how to structure complex AI projects
4. **Templates** - Use as a starting point for similar projects
5. **Documentation** - Provide examples for users

## 🔍 Verification

After creation, you can verify the project by:

1. **Visit the project page**: `http://localhost:3000/projects/{projectId}`
2. **Check bot functionality**: Test the customer service bot
3. **Verify pipeline**: Check the data processing pipeline
4. **View analytics**: Access the analytics dashboard
5. **Test integrations**: Verify all components work together

## 🛠️ Troubleshooting

### Common Issues

1. **Connection Error**: Make sure your server is running
2. **API Error**: Check that the API endpoints are accessible
3. **Database Error**: Ensure your database is properly configured
4. **Permission Error**: Verify you have the necessary permissions

### Debug Mode
Both scripts include detailed logging. Check the console output for:
- API request details
- Response data
- Error messages
- Success confirmations

## 📝 Notes

- The scripts create real database entries
- All components are set to "active" status
- The project is marked as "featured"
- IDs are auto-generated by the database
- The project can be modified after creation

## 🎉 Success!

Once the script completes successfully, you'll have a fully functional reference project that demonstrates:
- Project management
- Bot creation and configuration
- Pipeline processing
- Analytics and monitoring
- Integration between components

This serves as an excellent example for users to understand the platform's capabilities and as a template for building similar projects. 