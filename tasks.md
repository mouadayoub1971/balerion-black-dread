# Serverless Chatbot Application - Setup & Deployment Guide

## Project Overview
A serverless chatbot application that can:
- Respond to user questions
- Generate images
- Use built-in tools (weather, calculator, web search) via Gemini Function Calling
- Store chat history
- Save generated images

## Architecture
- **Frontend**: Static website (HTML/CSS/JS or React)
- **API**: AWS API Gateway (REST or HTTP API)
- **Backend**: AWS Lambda functions (Node.js/Python)
- **Database**: DynamoDB (chat messages)
- **Storage**: S3 (generated images, static frontend)
- **AI Integration**: External API (OpenAI, Anthropic Claude, etc.)

---

## Phase 1: Prerequisites & AWS Account Setup

### 1.1 Install Required Tools
- [ ] Install AWS CLI (`aws --version`)
- [ ] Install Node.js and npm (`node --version`)
- [ ] Install Serverless Framework 
  ```bash
  npm install -g serverless+
  ```
- [ ] Install Git (`git --version`)

### 1.2 AWS Account Configuration
- [ ] Create/Login to AWS account
- [ ] Create IAM user with programmatic access
- [ ] Attach policies: `AdministratorAccess` (for development) or custom policy with:
  - Lambda, API Gateway, DynamoDB, S3, CloudWatch Logs permissions
- [ ] Configure AWS credentials locally:
  ```bash
  aws configure
  # Enter: Access Key ID, Secret Access Key, Region (us-east-1), Format (json)
  ```
- [ ] Verify credentials: `aws sts get-caller-identity`

### 1.3 Get API Keys
- [ ] Sign up for Google AI Studio (https://aistudio.google.com/)
- [ ] Get Google Gemini API key (used for both chat and image generation)
  - Navigate to API keys section
  - Create new API key
  - Note: Free tier includes 15 requests/minute for Gemini 2.0 Flash
- [ ] (Optional) Get OpenWeatherMap API key for weather tool
  - Sign up at https://openweathermap.org/api
  - Free tier: 1,000 calls/day, no credit card required
- [ ] Store keys securely (AWS Secrets Manager or SSM Parameter Store)

---

## Phase 2: Infrastructure Setup

### 2.1 Create S3 Buckets
```bash
# Bucket for generated images
aws s3 mb s3://chatbot-images-[unique-id] --region us-east-1

# Bucket for frontend static files
aws s3 mb s3://chatbot-frontend-[unique-id] --region us-east-1

# Enable versioning (optional)
aws s3api put-bucket-versioning \
  --bucket chatbot-images-[unique-id] \
  --versioning-configuration Status=Enabled

# Configure CORS for images bucket
```
- [ ] Create images S3 bucket
- [ ] Create frontend S3 bucket
- [ ] Configure bucket policies (public read for frontend, private for images with signed URLs)
- [ ] Enable CORS on images bucket

### 2.2 Create DynamoDB Table
```bash
aws dynamodb create-table \
  --table-name ChatMessages \
  --attribute-definitions \
    AttributeName=sessionId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=sessionId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```
- [ ] Create ChatMessages table
- [ ] Add GSI if needed (e.g., for user queries)
- [ ] Verify table creation: `aws dynamodb describe-table --table-name ChatMessages`

### 2.3 Store API Keys in AWS Systems Manager
```bash
# Store Google Gemini API key (used for both chat and image generation)
aws ssm put-parameter \
  --name "/chatbot/gemini-api-key" \
  --value "your-gemini-api-key" \
  --type SecureString \
  --region us-east-1
```
- [ ] Store Gemini API key
- [ ] Note parameter name for Lambda environment variables: `/chatbot/gemini-api-key`

---

## Phase 3: Backend Development

### 3.1 Project Structure
```
backend/
├── functions/
│   ├── chat/
│   │   ├── handler.js (or .py)
│   │   └── package.json
│   ├── generateImage/
│   │   ├── handler.js
│   │   └── package.json
│   ├── getHistory/
│   │   ├── handler.js
│   │   └── package.json
│   └── functionCall/
│       ├── handler.js
│       └── package.json
├── layers/ (shared dependencies)
├── serverless.yml (or template.yaml for SAM)
└── package.json
```
- [ ] Create project folder structure
- [ ] Initialize npm: `npm init -y`

### 3.2 Lambda Functions to Create

#### Function 1: Chat Handler
- [ ] **Endpoint**: POST /chat
- [ ] **Purpose**: Process user messages, call Gemini API, return response
- [ ] **Code**:
  - Parse incoming message from request body
  - Call Google Gemini API:
    ```
    POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
    Header: x-goog-api-key: YOUR_API_KEY
    Body: { "contents": [{ "parts": [{ "text": "user message" }] }] }
    ```
  - Save user message and AI response to DynamoDB
  - Return AI response
- [ ] **Environment Variables**: GEMINI_API_KEY, DYNAMODB_TABLE
- [ ] **Response format**: Extract text from `response.candidates[0].content.parts[0].text`

#### Function 2: Image Generator
- [ ] **Endpoint**: POST /generate-image
- [ ] **Purpose**: Generate images from text prompts using Google Imagen
- [ ] **Code**:
  - Parse prompt from request body
  - Call Google Imagen API:
    ```
    POST https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict
    Header: x-goog-api-key: YOUR_API_KEY
    Body: {
      "instances": [{ "prompt": "user prompt" }],
      "parameters": { "sampleCount": 1 }
    }
    ```
  - Decode base64 image from response
  - Upload image to S3 bucket with unique filename
  - Save metadata (prompt, S3 key, timestamp) to DynamoDB
  - Generate signed S3 URL (valid for 1 hour)
  - Return S3 URL
- [ ] **Environment Variables**: GEMINI_API_KEY, S3_BUCKET, DYNAMODB_TABLE
- [ ] **Note**: Response contains base64-encoded images in `predictions[0].bytesBase64Encoded`

#### Function 3: Get Chat History
- [ ] **Endpoint**: GET /history/{sessionId}
- [ ] **Purpose**: Retrieve conversation history
- [ ] **Code**:
  - Query DynamoDB by sessionId
  - Return formatted messages
- [ ] **Environment Variables**: DYNAMODB_TABLE

#### Function 4: Function Calling Handler (Gemini Tools)
- [ ] **Endpoint**: POST /function-call
- [ ] **Purpose**: Execute tools using Gemini's native function calling
- [ ] **Available Tools**:
  - `get_weather`: Get current weather for a location
  - `search_web`: Search the web using DuckDuckGo
  - `calculate`: Perform mathematical calculations
  - `get_time`: Get current time in any timezone
- [ ] **Code**:
  - Define function declarations for Gemini
  - Send message with tools to Gemini API
  - If Gemini requests function call, execute it
  - Send function result back to Gemini
  - Return final response
- [ ] **Environment Variables**: GEMINI_API_KEY, DYNAMODB_TABLE

### 3.3 Example Lambda Code

#### Chat Handler Example (Node.js)
```javascript
// functions/chat/handler.js
const AWS = require('aws-sdk');
const https = require('https');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { message, sessionId } = body;

    // Get API key from SSM
    const apiKey = await ssm.getParameter({
      Name: '/chatbot/gemini-api-key',
      WithDecryption: true
    }).promise();

    // Call Gemini API
    const geminiResponse = await callGeminiAPI(message, apiKey.Parameter.Value);
    const aiResponse = geminiResponse.candidates[0].content.parts[0].text;

    // Save to DynamoDB
    const timestamp = Date.now();
    await dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        sessionId,
        timestamp,
        userMessage: message,
        aiResponse: aiResponse,
        type: 'chat'
      }
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        response: aiResponse,
        timestamp
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function callGeminiAPI(message, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [{
        parts: [{ text: message }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.0-flash:generateContent',
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
```

#### Image Generator Example (Node.js)
```javascript
// functions/generateImage/handler.js
const AWS = require('aws-sdk');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const ssm = new AWS.SSM();

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { prompt, sessionId } = body;

    // Get API key
    const apiKey = await ssm.getParameter({
      Name: '/chatbot/gemini-api-key',
      WithDecryption: true
    }).promise();

    // Call Imagen API
    const imageResponse = await callImagenAPI(prompt, apiKey.Parameter.Value);
    const base64Image = imageResponse.predictions[0].bytesBase64Encoded;

    // Upload to S3
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const filename = `${uuidv4()}.png`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: `images/${filename}`,
      Body: imageBuffer,
      ContentType: 'image/png'
    }).promise();

    // Generate signed URL (valid 1 hour)
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET,
      Key: `images/${filename}`,
      Expires: 3600
    });

    // Save metadata to DynamoDB
    await dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        sessionId,
        timestamp: Date.now(),
        prompt,
        imageKey: `images/${filename}`,
        type: 'image'
      }
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        imageUrl: signedUrl,
        filename
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function callImagenAPI(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1 }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/imagen-4.0-generate-001:predict',
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
```

#### Function Calling Handler Example (Node.js)
```javascript
// functions/functionCall/handler.js
const AWS = require('aws-sdk');
const https = require('https');

const ssm = new AWS.SSM();

// Define available tools
const tools = [
  {
    name: 'get_weather',
    description: 'Get current weather for a specific location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or location'
        }
      },
      required: ['location']
    }
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)")'
        }
      },
      required: ['expression']
    }
  },
  {
    name: 'search_web',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        }
      },
      required: ['query']
    }
  }
];

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { message, sessionId } = body;

    // Get API key
    const apiKey = await ssm.getParameter({
      Name: '/chatbot/gemini-api-key',
      WithDecryption: true
    }).promise();

    // Call Gemini with function declarations
    let geminiResponse = await callGeminiWithTools(
      message,
      tools,
      apiKey.Parameter.Value
    );

    // Check if Gemini wants to call a function
    const functionCall = geminiResponse.candidates[0]?.content?.parts[0]?.functionCall;

    if (functionCall) {
      // Execute the requested function
      const functionResult = await executeFunction(
        functionCall.name,
        functionCall.args
      );

      // Send function result back to Gemini
      geminiResponse = await sendFunctionResult(
        message,
        tools,
        functionCall,
        functionResult,
        apiKey.Parameter.Value
      );
    }

    const finalResponse = geminiResponse.candidates[0].content.parts[0].text;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        response: finalResponse,
        functionCalled: functionCall?.name || null
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Execute the function requested by Gemini
async function executeFunction(functionName, args) {
  switch (functionName) {
    case 'get_weather':
      return await getWeather(args.location);
    case 'calculate':
      return calculate(args.expression);
    case 'search_web':
      return await searchWeb(args.query);
    default:
      return { error: 'Unknown function' };
  }
}

// Weather function (using free OpenWeatherMap API)
async function getWeather(location) {
  // You'll need to get a free API key from openweathermap.org
  const apiKey = 'YOUR_OPENWEATHER_API_KEY'; // Store in SSM in production
  return new Promise((resolve, reject) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;

    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({
            location: data.name,
            temperature: data.main.temp,
            description: data.weather[0].description,
            humidity: data.main.humidity
          });
        } catch (e) {
          resolve({ error: 'Could not fetch weather' });
        }
      });
    }).on('error', () => resolve({ error: 'Weather API unavailable' }));
  });
}

// Calculator function
function calculate(expression) {
  try {
    // Safe evaluation (basic math only)
    const result = Function('"use strict"; return (' + expression + ')')();
    return { result: result };
  } catch (error) {
    return { error: 'Invalid expression' };
  }
}

// Web search function (using DuckDuckGo - no API key needed)
async function searchWeb(query) {
  return new Promise((resolve) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;

    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({
            abstract: data.Abstract || 'No results found',
            source: data.AbstractSource,
            url: data.AbstractURL
          });
        } catch (e) {
          resolve({ error: 'Search failed' });
        }
      });
    }).on('error', () => resolve({ error: 'Search unavailable' }));
  });
}

// Call Gemini with function declarations
function callGeminiWithTools(message, tools, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [{
        parts: [{ text: message }]
      }],
      tools: [{
        function_declarations: tools
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.0-flash:generateContent',
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Send function result back to Gemini
function sendFunctionResult(originalMessage, tools, functionCall, result, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [
        {
          parts: [{ text: originalMessage }]
        },
        {
          parts: [{
            functionCall: {
              name: functionCall.name,
              args: functionCall.args
            }
          }]
        },
        {
          parts: [{
            functionResponse: {
              name: functionCall.name,
              response: result
            }
          }]
        }
      ],
      tools: [{
        function_declarations: tools
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.0-flash:generateContent',
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
```

#### package.json for Lambda Functions
```json
{
  "name": "chatbot-lambda",
  "version": "1.0.0",
  "dependencies": {
    "aws-sdk": "^2.1691.0",
    "uuid": "^9.0.0"
  }
}
```

### 3.4 Create IAM Role for Lambda
```yaml
# Permissions needed:
- DynamoDB: PutItem, GetItem, Query, Scan
- S3: PutObject, GetObject
- SSM: GetParameter
- CloudWatch Logs: CreateLogGroup, CreateLogStream, PutLogEvents
```
- [ ] Create execution role
- [ ] Attach policies
- [ ] Note role ARN

### 3.4 Deploy Lambda Functions
```bash
# Using Serverless Framework
serverless deploy

# OR using AWS SAM
sam build
sam deploy --guided

# OR using AWS CLI
cd functions/chat
zip -r function.zip .
aws lambda create-function \
  --function-name chatbot-chat-handler \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler handler.main \
  --zip-file fileb://function.zip \
  --environment Variables={TABLE_NAME=ChatMessages}
```
- [ ] Deploy all Lambda functions
- [ ] Test each function individually
- [ ] Verify CloudWatch logs

---

## Phase 4: API Gateway Setup

### 4.1 Create API Gateway
- [ ] Choose HTTP API (cheaper) or REST API
- [ ] Create API: `aws apigateway create-rest-api --name chatbot-api`
- [ ] Create resources and methods:
  - POST /chat → Lambda: chat-handler
  - POST /generate-image → Lambda: image-generator
  - GET /history/{sessionId} → Lambda: get-history
  - POST /function-call → Lambda: function-call-handler

### 4.2 Configure CORS
```bash
# Enable CORS for all endpoints
```
- [ ] Add CORS headers to API Gateway
- [ ] Test OPTIONS preflight requests

### 4.3 Deploy API
```bash
aws apigateway create-deployment \
  --rest-api-id [API-ID] \
  --stage-name prod
```
- [ ] Deploy API to stage (dev/prod)
- [ ] Note API Gateway URL (e.g., https://xyz.execute-api.us-east-1.amazonaws.com/prod)
- [ ] Test endpoints with curl/Postman

---

## Phase 5: Frontend Development

### 5.1 Create Frontend Structure
```
frontend/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── chat.js
│   └── config.js
└── assets/
    └── images/
```
- [ ] Create HTML structure
- [ ] Add chat UI (input, message display, image gallery)
- [ ] Style with CSS

### 5.2 Implement Frontend Logic
- [ ] **config.js**: Store API Gateway URL
- [ ] **chat.js**:
  - Send messages to /chat endpoint
  - Display responses
  - Handle errors
- [ ] **app.js**:
  - Initialize chat session (generate sessionId)
  - Load chat history
  - Handle image generation requests
  - Display generated images
- [ ] Add loading states and error handling
- [ ] Implement session management (localStorage/sessionStorage)

### 5.3 Test Locally
- [ ] Run local server: `python -m http.server 8000` or `npx serve`
- [ ] Test all features
- [ ] Verify API calls work

---

## Phase 6: Deployment

### 6.1 Deploy Frontend to S3
```bash
# Build frontend (if using React/Vue)
npm run build

# Upload to S3
aws s3 sync ./frontend s3://chatbot-frontend-[unique-id]

# Configure static website hosting
aws s3 website s3://chatbot-frontend-[unique-id] \
  --index-document index.html \
  --error-document error.html

# Set bucket policy for public read
```
- [ ] Upload frontend files to S3
- [ ] Enable static website hosting
- [ ] Set bucket policy for public access
- [ ] Note website URL: http://chatbot-frontend-[unique-id].s3-website-us-east-1.amazonaws.com

### 6.2 (Optional) Setup CloudFront CDN
- [ ] Create CloudFront distribution
- [ ] Point to S3 bucket origin
- [ ] Configure caching
- [ ] Get CloudFront URL (https://xyz.cloudfront.net)
- [ ] Update DNS if using custom domain

### 6.3 Configure Custom Domain (Optional)
- [ ] Register domain (Route 53 or external)
- [ ] Create SSL certificate (ACM)
- [ ] Configure CloudFront with custom domain
- [ ] Update Route 53 DNS records

---

## Phase 7: Testing & Optimization

### 7.1 End-to-End Testing
- [ ] Test chat functionality
- [ ] Test image generation
- [ ] Test chat history retrieval
- [ ] Test function calling (weather, calculator, web search)
- [ ] Verify error handling
- [ ] Test on different browsers/devices

### 7.2 Performance Optimization
- [ ] Configure Lambda memory (128MB-1024MB based on usage)
- [ ] Set Lambda timeout appropriately (30s max for API Gateway)
- [ ] Enable DynamoDB point-in-time recovery (if needed)
- [ ] Configure S3 lifecycle policies (delete old images after X days)
- [ ] Enable CloudWatch alarms for errors/throttling

### 7.3 Cost Optimization (Free Tier)
- [ ] Use HTTP API instead of REST API (cheaper)
- [ ] Set DynamoDB to on-demand pricing
- [ ] Configure S3 lifecycle rules to delete old files
- [ ] Monitor AWS Cost Explorer
- [ ] Set billing alerts
- [ ] Use Lambda reserved concurrency to limit costs

**Free Tier Limits to Monitor:**
- Lambda: 1M requests/month, 400,000 GB-seconds compute
- API Gateway: 1M API calls/month (HTTP API)
- DynamoDB: 25 GB storage, 25 WCU, 25 RCU
- S3: 5 GB storage, 20,000 GET requests, 2,000 PUT requests
- CloudWatch: 5 GB logs, 10 custom metrics

---

## Phase 8: Monitoring & Maintenance

### 8.1 Setup Monitoring
- [ ] Enable CloudWatch Logs for all Lambdas
- [ ] Create CloudWatch Dashboard
- [ ] Set up alarms:
  - Lambda errors
  - API Gateway 4xx/5xx errors
  - DynamoDB throttling
  - S3 bucket size
- [ ] Configure SNS notifications

### 8.2 Security Hardening
- [ ] Implement API authentication (API keys or Cognito)
- [ ] Add rate limiting to prevent abuse
- [ ] Encrypt data at rest (S3, DynamoDB)
- [ ] Use HTTPS only
- [ ] Implement input validation
- [ ] Review IAM policies (least privilege)
- [ ] Enable AWS WAF (optional, costs extra)

### 8.3 Documentation
- [ ] Document API endpoints
- [ ] Create user guide
- [ ] Document deployment process
- [ ] Add README.md with setup instructions

---

## Quick Deployment Checklist

**One-time Setup:**
1. ✓ AWS account configured
2. ✓ Tools installed
3. ✓ API keys obtained
4. ✓ S3 buckets created
5. ✓ DynamoDB table created
6. ✓ Secrets stored in SSM

**Per Deployment:**
1. ✓ Update Lambda code
2. ✓ Deploy functions
3. ✓ Test API endpoints
4. ✓ Build frontend
5. ✓ Upload to S3
6. ✓ Test end-to-end
7. ✓ Monitor logs

---

## Useful Commands

```bash
# View Lambda logs
aws logs tail /aws/lambda/chatbot-chat-handler --follow

# Test Lambda locally (SAM)
sam local invoke chatbot-chat-handler -e test-event.json

# Check DynamoDB items
aws dynamodb scan --table-name ChatMessages

# List S3 files
aws s3 ls s3://chatbot-images-[unique-id]

# API Gateway test
curl -X POST https://[api-id].execute-api.us-east-1.amazonaws.com/prod/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "sessionId": "test-123"}'

# Delete stack (cleanup)
serverless remove
# OR
sam delete
```

---

## Estimated Monthly Costs (Within Free Tier)

Assuming light usage (< 100 requests/day):
- Lambda: $0 (within 1M requests)
- API Gateway: $0 (within 1M requests)
- DynamoDB: $0 (within 25 GB)
- S3: $0-$1 (within 5 GB)
- CloudWatch: $0 (within limits)
- **External APIs**: $0 (Google Gemini free tier: 15 RPM, 1500 RPD)

**Total: $0/month** (fully within free tiers!)

**Gemini Free Tier Limits:**
- Gemini 2.0 Flash: 15 requests/minute, 1,500 requests/day
- Imagen 4.0: 15 requests/minute, 1,500 requests/day
- Rate limit: 4 million tokens/minute

---

## Gemini Function Calling & Free APIs

### What is Function Calling?
Gemini's native function calling allows the AI to intelligently decide when to use tools. You define functions (weather, calculator, etc.) and Gemini automatically calls them when needed, then uses the results to answer the user.

### Free APIs for Tools

#### 1. Weather - OpenWeatherMap
- **URL**: https://openweathermap.org/api
- **Free Tier**: 1,000 calls/day
- **Signup**: https://home.openweathermap.org/users/sign_up
- **No credit card required**

#### 2. Web Search - DuckDuckGo
- **URL**: https://api.duckduckgo.com/
- **Free Tier**: Unlimited (no API key needed!)
- **No signup required**

#### 3. Calculator
- Built-in JavaScript evaluation (no API needed)

#### 4. Additional Free APIs (Optional)
- **IP Geolocation**: https://ip-api.com/ (45 requests/minute)
- **Currency Exchange**: https://exchangerate-api.com/ (1,500 requests/month)
- **Wikipedia**: https://www.mediawiki.org/wiki/API:Main_page (unlimited)
- **Random Facts**: https://uselessfacts.jsph.pl/api (unlimited)
- **Jokes**: https://official-joke-api.appspot.com/ (unlimited)

### How Function Calling Works

1. **User asks**: "What's the weather in Paris?"
2. **Gemini decides**: "I need to call get_weather function"
3. **Lambda executes**: Calls OpenWeatherMap API
4. **Gemini responds**: "It's 18°C and partly cloudy in Paris"

All of this happens automatically - you just define the functions!

---

## Troubleshooting

**Lambda timeout errors:**
- Increase timeout setting
- Check AI API response time

**CORS errors:**
- Verify API Gateway CORS settings
- Check Lambda response headers

**DynamoDB throttling:**
- Switch to on-demand mode
- Increase provisioned capacity

**S3 access denied:**
- Check bucket policy
- Verify IAM role permissions

**High costs:**
- Check CloudWatch metrics
- Look for runaway loops
- Review billing dashboard

---

## Next Steps

1. Start with Phase 1 (Prerequisites)
2. Follow phases sequentially
3. Test after each phase
4. Deploy incrementally
5. Monitor costs daily during initial setup

**Remember:** Delete resources when not in use to avoid charges!
echo "# balerion-black-dread" >> README.md
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/mouadayoub1971/balerion-black-dread.git
git push -u origin main