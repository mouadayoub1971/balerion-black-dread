# Architecture Documentation - Alfredo AI Assistant

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [AWS Services Overview](#aws-services-overview)
3. [Component Interaction Flow](#component-interaction-flow)
4. [Detailed Architecture](#detailed-architecture)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Security Architecture](#security-architecture)
7. [Scalability & Performance](#scalability--performance)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                                │
│                   (Frontend - Static Website)                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS CLOUD                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              S3 Bucket (Frontend Hosting)                     │   │
│  │  • index.html  • style.css  • JavaScript modules              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               │                                      │
│                               │ API Calls (REST)                     │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              API Gateway (HTTP API)                           │   │
│  │  9 Routes: /chat, /generate-image, /generate-video,          │   │
│  │  /history, /function-call, /process-document,                │   │
│  │  /web-search, /maps-search, /process-audio                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               │                                      │
│         ┌────────┬────────┬───┴────┬────────┬────────┐              │
│         ▼        ▼        ▼        ▼        ▼        ▼              │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ Lambda 1 │ │  L2  │ │  L3  │ │  L4  │ │  L5  │ │ ...  │         │
│  │  Chat    │ │Image │ │Video │ │Hist  │ │Func  │ │ +4   │         │
│  └──────────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
│                                  (9 Lambda Functions Total)         │
│         │                │                 │                         │
│         ▼                ▼                 ▼                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  DynamoDB Table                               │   │
│  │  ChatMessages: sessionId (HASH), timestamp (RANGE)            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              S3 Bucket (Images Storage)                       │   │
│  │  Private bucket with signed URLs                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            SSM Parameter Store                                │   │
│  │  Encrypted API keys (Gemini, OpenWeather)                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ External API Calls
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GOOGLE CLOUD SERVICES                             │
│  • Gemini 2.5 Flash API (Chat)                                      │
│  • Imagen 4.0 API (Image Generation)                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## AWS Services Overview

### 1. **S3 (Simple Storage Service)** - 2 Buckets

#### Frontend Bucket
```
Name: chatbot-frontend-v2-1971
Purpose: Static website hosting
Configuration:
  - Public read access
  - Website hosting enabled
  - Index document: index.html

Files:
├── index.html
├── css/
│   └── style.css
└── js/
    ├── config.js
    ├── app.js
    ├── chat.js
    ├── imageGenerator.js
    ├── videoGenerator.js
    ├── documentProcessor.js
    ├── webSearch.js
    └── mapsSearch.js

Access: http://chatbot-frontend-v2-1971.s3-website-us-east-1.amazonaws.com
```

#### Images Bucket
```
Name: chatbot-images-v2-1971
Purpose: Store generated images
Configuration:
  - Private bucket (ACL: private)
  - Signed URLs with 1-hour expiry
  - Organized by date/session

Structure:
images/
├── {uuid-1}.png
├── {uuid-2}.png
└── {uuid-n}.png

Access: Pre-signed URLs generated by Lambda
```

### 2. **API Gateway (HTTP API)**

```
API ID: 6vq08jvvp4
Base URL: https://6vq08jvvp4.execute-api.us-east-1.amazonaws.com
Stage: /dev

Routes (9 total):
┌──────────────────────┬──────────┬────────────────────────┬──────────┐
│ Route                │ Method   │ Lambda Function        │ Status   │
├──────────────────────┼──────────┼────────────────────────┼──────────┤
│ /dev/chat            │ POST     │ chat-handler           │ ✅ Active│
│ /dev/generate-image  │ POST     │ image-generator        │ ✅ Active│
│ /dev/generate-video  │ POST     │ video-generator        │ 🚧 Dev   │
│ /dev/history/{id}    │ GET      │ get-history            │ ✅ Active│
│ /dev/function-call   │ POST     │ function-call          │ 🚧 Dev   │
│ /dev/process-document│ POST     │ process-document       │ 🚧 Dev   │
│ /dev/web-search      │ POST     │ web-search             │ 🚧 Dev   │
│ /dev/maps-search     │ POST     │ maps-search            │ 🚧 Dev   │
│ /dev/process-audio   │ POST     │ process-audio          │ 🚧 Dev   │
└──────────────────────┴──────────┴────────────────────────┴──────────┘

CORS Configuration:
  - allow_origins: ["*"]
  - allow_methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"]
  - allow_headers: ["*"]
  - expose_headers: ["*"]
  - max_age: 300
```

### 3. **Lambda Functions** - 9 Functions (3 Active, 6 In Development)

#### Function 1: Chat Handler (✅ ACTIVE)
```
Name: chatbot-v2-dev-chat-handler
Runtime: Node.js 18.x
Memory: 256 MB
Timeout: 30 seconds
Environment Variables:
  - DYNAMODB_TABLE: ChatMessages-v2
  - GEMINI_API_KEY_PARAM: /chatbot/gemini-api-key

Trigger: API Gateway POST /dev/chat

Functionality:
  1. Receive user message
  2. Fetch Gemini API key from SSM
  3. Call Gemini 2.5 Flash API
  4. Store conversation in DynamoDB
  5. Return AI response

IAM Permissions:
  - dynamodb:PutItem
  - ssm:GetParameter
  - logs:CreateLogGroup
  - logs:CreateLogStream
  - logs:PutLogEvents
```

#### Function 2: Image Generator (✅ ACTIVE)
```
Name: chatbot-v2-dev-image-generator
Runtime: Node.js 18.x
Memory: 512 MB
Timeout: 60 seconds
Environment Variables:
  - S3_BUCKET: chatbot-images-v2-1971
  - DYNAMODB_TABLE: ChatMessages-v2
  - GEMINI_API_KEY_PARAM: /chatbot/gemini-api-key

Trigger: API Gateway POST /dev/generate-image

Functionality:
  1. Validate prompt
  2. Check celebrity keyword blocklist
  3. Fetch Gemini API key from SSM
  4. Call Imagen 4.0 API
  5. Upload image to S3
  6. Generate signed URL (1-hour expiry)
  7. Store metadata in DynamoDB
  8. Return signed URL

IAM Permissions:
  - s3:PutObject
  - s3:GetObject
  - dynamodb:PutItem
  - ssm:GetParameter
  - logs:*
```

#### Function 3: Video Generator (🚧 IN DEVELOPMENT)
```
Name: chatbot-v2-dev-video-generator
Runtime: Node.js 18.x
Memory: 1024 MB (1 GB)
Timeout: 900 seconds (15 minutes)
Environment Variables:
  - DYNAMODB_TABLE: ChatMessages-v2
  - S3_BUCKET: chatbot-images-v2-1971
  - GEMINI_API_KEY_PARAM: /chatbot/gemini-api-key

Trigger: API Gateway POST /dev/generate-video

Functionality:
  1. Receive video generation prompt
  2. Call Google Veo/Imagen API for video
  3. Store video in S3
  4. Generate signed URL (24-hour expiry)
  5. Store metadata in DynamoDB
  6. Return video URL

Note: Requires higher memory and longer timeout for video processing
```

#### Function 4: Get History (✅ ACTIVE)
```
Name: chatbot-v2-dev-get-history
Runtime: Node.js 18.x
Memory: 128 MB
Timeout: 10 seconds
Environment Variables:
  - DYNAMODB_TABLE: ChatMessages-v2

Trigger: API Gateway GET /dev/history?sessionId={id}

Functionality:
  1. Query DynamoDB by sessionId
  2. Sort by timestamp (descending)
  3. Return conversation history

IAM Permissions:
  - dynamodb:Query
  - logs:*
```

#### Function 5: Function Call Handler (🚧 IN DEVELOPMENT)
```
Name: chatbot-v2-dev-function-call
Runtime: Node.js 18.x
Memory: 256 MB
Timeout: 30 seconds
Environment Variables:
  - DYNAMODB_TABLE: ChatMessages-v2
  - GEMINI_API_KEY_PARAM: /chatbot/gemini-api-key
  - OPENWEATHER_API_KEY: (optional)

Trigger: API Gateway POST /dev/function-call

Functionality:
  1. Receive function call request
  2. Execute tools: get_weather, calculate, search_web
  3. Return tool results to chat handler

Available Tools:
  - get_weather: OpenWeather API integration
  - calculate: Math expression evaluation
  - search_web: Web search capability
```

#### Function 6: Process Document (🚧 IN DEVELOPMENT)
```
Name: chatbot-v2-dev-process-document
Runtime: Node.js 18.x
Memory: 1024 MB (1 GB)
Timeout: 120 seconds (2 minutes)
Environment Variables:
  - DYNAMODB_TABLE: ChatMessages-v2
  - GEMINI_API_KEY_PARAM: /chatbot/gemini-api-key
  - S3_BUCKET: chatbot-images-v2-1971

Trigger: API Gateway POST /dev/process-document

Functionality:
  1. Receive PDF/document upload
  2. Extract text with Gemini document understanding
  3. Process with Gemini 2.5 Flash
  4. Store results in DynamoDB
  5. Return analysis/summary

MCP Integration: /teacher command
```

#### Function 7: Web Search (🚧 IN DEVELOPMENT)
```
Name: chatbot-v2-dev-web-search
Runtime: Node.js 18.x
Memory: 256 MB
Timeout: 30 seconds
Environment Variables:
  - DYNAMODB_TABLE: ChatMessages-v2
  - GEMINI_API_KEY_PARAM: /chatbot/gemini-api-key

Trigger: API Gateway POST /dev/web-search

Functionality:
  1. Receive search query
  2. Perform web search via MCP server
  3. Return search results with links
  4. Store in DynamoDB

MCP Integration: /search command
Frontend: webSearch.js module
```

#### Function 8: Maps Search (🚧 IN DEVELOPMENT)
```
Name: chatbot-v2-dev-maps-search
Runtime: Node.js 18.x
Memory: 256 MB
Timeout: 30 seconds
Environment Variables:
  - DYNAMODB_TABLE: ChatMessages-v2
  - GEMINI_API_KEY_PARAM: /chatbot/gemini-api-key

Trigger: API Gateway POST /dev/maps-search

Functionality:
  1. Receive location query
  2. Search places via MCP server
  3. Return location data (places, reviews, ratings)
  4. Store in DynamoDB

MCP Integration: /maps command
Frontend: mapsSearch.js module
Features: Place search, directions, ratings, reviews
```

#### Function 9: Process Audio (🚧 IN DEVELOPMENT)
```
Name: chatbot-v2-dev-process-audio
Runtime: Node.js 18.x
Memory: 1024 MB (1 GB)
Timeout: 120 seconds (2 minutes)
Environment Variables:
  - DYNAMODB_TABLE: ChatMessages-v2
  - GEMINI_API_KEY_PARAM: /chatbot/gemini-api-key
  - S3_BUCKET: chatbot-images-v2-1971

Trigger: API Gateway POST /dev/process-audio

Functionality:
  1. Receive audio file upload
  2. Transcribe with Gemini audio understanding
  3. Process/analyze audio content
  4. Store results in DynamoDB
  5. Return transcription/analysis

Supported formats: MP3, WAV, M4A, etc.
```

### 4. **DynamoDB**

```
Table Name: ChatMessages-v2
Billing Mode: PAY_PER_REQUEST (On-Demand)

Schema:
┌──────────────┬──────────┬─────────────────────────────────┐
│ Attribute    │ Type     │ Description                     │
├──────────────┼──────────┼─────────────────────────────────┤
│ sessionId    │ STRING   │ HASH Key (Partition Key)        │
│ timestamp    │ NUMBER   │ RANGE Key (Sort Key)            │
│ userMessage  │ STRING   │ User's message                  │
│ aiResponse   │ STRING   │ AI's response                   │
│ type         │ STRING   │ "chat", "image", "video",       │
│              │          │ "document", "audio", "function" │
│ imageUrl     │ STRING   │ S3 signed URL (for media)       │
│ prompt       │ STRING   │ Generation prompt               │
│ imageKey     │ STRING   │ S3 object key                   │
│ filename     │ STRING   │ Generated filename              │
│ ttl          │ NUMBER   │ Time to Live (expiration epoch) │
└──────────────┴──────────┴─────────────────────────────────┘

Features:
  - TTL Enabled: Yes (automatic data expiration)
  - TTL Attribute: ttl
  - Streams: Enabled (NEW_AND_OLD_IMAGES)
  - Indexes: None (using primary key only)
  - Encryption: AWS managed encryption at rest
  - Point-in-time Recovery: Available (optional)

Pricing Model: On-Demand (Free Tier: 25 GB storage, 25 WCU, 25 RCU)
```

### 5. **SSM Parameter Store** - 2 Parameters

```
Parameter 1: /chatbot/gemini-api-key (REQUIRED)
Type: SecureString
Encryption: AWS KMS (default)
Description: Google Gemini API key for chat and image generation
Used by: All Lambda functions
Value: Configured in terraform.tfvars

Parameter 2: /chatbot/openweather-api-key (OPTIONAL)
Type: SecureString
Encryption: AWS KMS (default)
Description: OpenWeatherMap API key for weather function
Used by: function-call Lambda
Value: Optional, only if using weather tool

Access Control:
  - Lambda execution roles have GetParameter permission
  - Encrypted in transit and at rest
  - Never exposed to frontend
  - IAM policy restricts access to specific parameters
```

### 6. **CloudWatch Logs** - 9 Log Groups

```
Log Groups (Auto-created by Lambda):
├── /aws/lambda/chatbot-v2-dev-chat-handler
├── /aws/lambda/chatbot-v2-dev-image-generator
├── /aws/lambda/chatbot-v2-dev-video-generator
├── /aws/lambda/chatbot-v2-dev-get-history
├── /aws/lambda/chatbot-v2-dev-function-call
├── /aws/lambda/chatbot-v2-dev-process-document
├── /aws/lambda/chatbot-v2-dev-web-search
├── /aws/lambda/chatbot-v2-dev-maps-search
└── /aws/lambda/chatbot-v2-dev-process-audio

Retention: Configurable (default: Never expire)
Pricing: Free Tier: 5 GB ingestion, 5 GB storage

Use Cases:
  - Real-time debugging
  - Error tracking and alerts
  - Performance monitoring
  - Audit trail
  - Integration with CloudWatch Insights

Access:
  aws logs tail /aws/lambda/chatbot-v2-dev-chat-handler --follow
```

---

## Component Interaction Flow

### Flow 1: Chat Message Processing

```
┌──────┐                                                      ┌────────┐
│ User │                                                      │ Gemini │
└──┬───┘                                                      │  API   │
   │                                                          └───▲────┘
   │ 1. Type message                                              │
   ├──────────────────────────────────────┐                      │
   │                                      │                      │
   ▼                                      ▼                      │
┌──────────────┐                   ┌──────────────┐             │
│  Browser JS  │                   │  S3 Frontend │             │
│  (app.js)    │◄──────────────────│    Bucket    │             │
└──────┬───────┘                   └──────────────┘             │
       │                                                         │
       │ 2. POST /dev/chat                                       │
       │ {message, sessionId}                                    │
       │                                                         │
       ▼                                                         │
┌────────────────────┐                                          │
│   API Gateway      │                                          │
│  (HTTP API)        │                                          │
└────────┬───────────┘                                          │
         │                                                       │
         │ 3. Invoke Lambda                                     │
         │                                                       │
         ▼                                                       │
┌───────────────────────┐          ┌──────────────┐             │
│  Chat Handler Lambda  │──────────┤     SSM      │             │
│                       │ 4. Get   │  Parameter   │             │
│  ┌─────────────────┐  │   API    │    Store     │             │
│  │ Validate input  │  │   Key    └──────────────┘             │
│  └────────┬────────┘  │                                       │
│           │           │                                       │
│  ┌────────▼────────┐  │                                       │
│  │ Fetch API key   │──┼───────────────────────────────────────┤
│  └────────┬────────┘  │ 5. Call Gemini API                    │
│           │           │                                       │
│  ┌────────▼────────┐  │◄──────────────────────────────────────┤
│  │ Get AI response │  │ 6. Return response                    │
│  └────────┬────────┘  │                                       │
│           │           │          ┌──────────────┐             │
│  ┌────────▼────────┐  │──────────┤   DynamoDB   │             │
│  │ Store in DB     │  │ 7. Put   │ ChatMessages │             │
│  └────────┬────────┘  │   Item   └──────────────┘             │
│           │           │                                       │
│  ┌────────▼────────┐  │                                       │
│  │ Return response │  │                                       │
│  └────────┬────────┘  │                                       │
└───────────┬───────────┘                                       │
            │                                                   │
            │ 8. Return JSON response                           │
            │ {response, timestamp, sessionId}                  │
            │                                                   │
            ▼                                                   │
┌────────────────────┐                                          │
│   API Gateway      │                                          │
└────────┬───────────┘                                          │
         │                                                      │
         │ 9. HTTP Response                                     │
         │                                                      │
         ▼                                                      │
┌──────────────┐                                                │
│  Browser JS  │                                                │
│ Display msg  │                                                │
└──────────────┘                                                │
```

### Flow 2: Image Generation Processing

```
┌──────┐                                                      ┌────────┐
│ User │                                                      │ Imagen │
└──┬───┘                                                      │  API   │
   │                                                          └───▲────┘
   │ 1. Type /image prompt                                        │
   │                                                              │
   ▼                                                              │
┌──────────────┐                                                 │
│  Browser JS  │                                                 │
│(imageGen.js) │                                                 │
└──────┬───────┘                                                 │
       │                                                         │
       │ 2. POST /dev/generate-image                             │
       │ {prompt, sessionId}                                     │
       │                                                         │
       ▼                                                         │
┌────────────────────┐                                          │
│   API Gateway      │                                          │
└────────┬───────────┘                                          │
         │                                                       │
         │ 3. Invoke Lambda                                     │
         │                                                       │
         ▼                                                       │
┌────────────────────────┐                                      │
│ Image Generator Lambda │                                      │
│                        │                                      │
│  ┌──────────────────┐  │                                      │
│  │ Validate prompt  │  │                                      │
│  └────────┬─────────┘  │                                      │
│           │            │                                      │
│  ┌────────▼─────────┐  │                                      │
│  │ Check celebrity  │  │                                      │
│  │ keyword blocklist│  │                                      │
│  └────────┬─────────┘  │                                      │
│           │            │                                      │
│  ┌────────▼─────────┐  │      ┌──────────────┐               │
│  │ Fetch API key    │──┼──────┤     SSM      │               │
│  └────────┬─────────┘  │      └──────────────┘               │
│           │            │                                      │
│  ┌────────▼─────────┐  │                                      │
│  │ Call Imagen API  │──┼──────────────────────────────────────┤
│  └────────┬─────────┘  │ 4. Generate image                    │
│           │            │◄─────────────────────────────────────┤
│  ┌────────▼─────────┐  │ 5. Base64 image                      │
│  │ Decode base64    │  │                                      │
│  └────────┬─────────┘  │                                      │
│           │            │      ┌──────────────┐               │
│  ┌────────▼─────────┐  │──────┤  S3 Images   │               │
│  │ Upload to S3     │  │ 6.   │   Bucket     │               │
│  └────────┬─────────┘  │ Put  └──────────────┘               │
│           │            │ Object                               │
│  ┌────────▼─────────┐  │                                      │
│  │ Generate signed  │  │                                      │
│  │ URL (1h expiry)  │  │                                      │
│  └────────┬─────────┘  │                                      │
│           │            │      ┌──────────────┐               │
│  ┌────────▼─────────┐  │──────┤   DynamoDB   │               │
│  │ Store metadata   │  │ 7.   └──────────────┘               │
│  └────────┬─────────┘  │ Put                                  │
│           │            │ Item                                 │
│  ┌────────▼─────────┐  │                                      │
│  │ Return URL       │  │                                      │
│  └────────┬─────────┘  │                                      │
└───────────┬────────────┘                                      │
            │                                                   │
            │ 8. Return {imageUrl, filename, timestamp}         │
            │                                                   │
            ▼                                                   │
┌────────────────────┐                                          │
│   API Gateway      │                                          │
└────────┬───────────┘                                          │
         │                                                      │
         │ 9. HTTP Response                                     │
         │                                                      │
         ▼                                                      │
┌──────────────┐                                                │
│  Browser JS  │                                                │
│ Display img  │                                                │
└──────────────┘                                                │
```

### Flow 3: Chat History Retrieval

```
┌──────┐
│ User │
└──┬───┘
   │ 1. Request history
   │
   ▼
┌──────────────┐
│  Browser JS  │
└──────┬───────┘
       │
       │ 2. GET /dev/history?sessionId={id}
       │
       ▼
┌────────────────────┐
│   API Gateway      │
└────────┬───────────┘
         │
         │ 3. Invoke Lambda
         │
         ▼
┌───────────────────────┐          ┌──────────────┐
│  Get History Lambda   │──────────┤   DynamoDB   │
│                       │ 4. Query │              │
│  ┌─────────────────┐  │   by     │              │
│  │ Validate params │  │   session│              │
│  └────────┬────────┘  │   ID     │              │
│           │           │          │              │
│  ┌────────▼────────┐  │◄─────────│              │
│  │ Query DynamoDB  │  │ 5. Items │              │
│  └────────┬────────┘  │          └──────────────┘
│           │           │
│  ┌────────▼────────┐  │
│  │ Sort by time    │  │
│  └────────┬────────┘  │
│           │           │
│  ┌────────▼────────┐  │
│  │ Format response │  │
│  └────────┬────────┘  │
└───────────┬───────────┘
            │
            │ 6. Return {sessionId, count, messages[]}
            │
            ▼
┌────────────────────┐
│   API Gateway      │
└────────┬───────────┘
         │
         │ 7. HTTP Response
         │
         ▼
┌──────────────┐
│  Browser JS  │
│ Display      │
│ history      │
└──────────────┘
```

---

## Detailed Architecture

### Frontend Architecture

```
Frontend Stack (Vanilla JavaScript - No Framework)
├── HTML5 (index.html)
│   ├── Semantic structure
│   ├── Accessibility features
│   └── SEO meta tags
│
├── CSS3 (style.css)
│   ├── OKLCH color space variables
│   ├── Dark/Light theme support
│   ├── Responsive design
│   ├── CSS Grid & Flexbox
│   └── Custom scrollbars
│
└── JavaScript (ES6 Modules)
    ├── config.js - API configuration
    ├── app.js - Main application logic
    │   ├── Theme management
    │   ├── Session management (UUID)
    │   ├── Event handlers
    │   └── UI state management
    │
    ├── chat.js - Chat module
    │   ├── Message display
    │   ├── Markdown rendering
    │   ├── API communication
    │   └── Error handling
    │
    ├── imageGenerator.js - Image module
    │   ├── Image commands parsing
    │   ├── Modal management
    │   ├── Image display
    │   └── Progress indicators
    │
    ├── videoGenerator.js - Video module (Future)
    ├── documentProcessor.js - PDF module (Future)
    ├── webSearch.js - Search integration (MCP)
    └── mapsSearch.js - Maps integration (MCP)
```

### Backend Architecture

```
Lambda Functions Architecture

Each Lambda follows this pattern:

┌─────────────────────────────────────┐
│         Lambda Function             │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  1. Input Validation          │  │
│  │     - Check required fields   │  │
│  │     - Sanitize inputs         │  │
│  └───────────┬───────────────────┘  │
│              │                      │
│  ┌───────────▼───────────────────┐  │
│  │  2. Authentication/Security   │  │
│  │     - CORS headers            │  │
│  │     - Rate limiting (future)  │  │
│  └───────────┬───────────────────┘  │
│              │                      │
│  ┌───────────▼───────────────────┐  │
│  │  3. Business Logic            │  │
│  │     - Process request         │  │
│  │     - Call external APIs      │  │
│  │     - Transform data          │  │
│  └───────────┬───────────────────┘  │
│              │                      │
│  ┌───────────▼───────────────────┐  │
│  │  4. Data Persistence          │  │
│  │     - DynamoDB operations     │  │
│  │     - S3 operations           │  │
│  └───────────┬───────────────────┘  │
│              │                      │
│  ┌───────────▼───────────────────┐  │
│  │  5. Response Formatting       │  │
│  │     - JSON structure          │  │
│  │     - Status codes            │  │
│  │     - Error messages          │  │
│  └───────────┬───────────────────┘  │
│              │                      │
│  ┌───────────▼───────────────────┐  │
│  │  6. Logging & Monitoring      │  │
│  │     - CloudWatch logs         │  │
│  │     - Error tracking          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Session Management

```
User Opens App
     │
     ▼
┌─────────────────────────┐
│ Check localStorage      │
│ for existing sessionId  │
└──────┬──────────────────┘
       │
       ├── Found ────────► Use existing sessionId
       │
       └── Not Found ────► Generate new UUID
                          │
                          ▼
                   ┌──────────────────┐
                   │ Store in         │
                   │ localStorage     │
                   └──────────────────┘
                          │
                          ▼
                   Display in footer
                   "Session: abc-123-..."
```

### Image Storage Flow

```
User Requests Image
     │
     ▼
Lambda Generates Image (Base64)
     │
     ▼
Convert to Buffer
     │
     ▼
┌────────────────────────────┐
│ Generate unique filename   │
│ Format: {UUID}.png         │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Upload to S3               │
│ Key: images/{UUID}.png     │
│ Metadata:                  │
│   - prompt                 │
│   - sessionId              │
│   - generatedAt            │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Generate Signed URL        │
│ Expiry: 1 hour             │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Store metadata in DynamoDB │
│ {sessionId, timestamp,     │
│  imageKey, filename, type} │
└──────────┬─────────────────┘
           │
           ▼
     Return URL to user
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Network Security                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • HTTPS only (API Gateway enforced)                      │   │
│  │ • CORS configuration (controlled origins)                │   │
│  │ • No direct access to Lambda (API Gateway proxy)         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Layer 2: Authentication & Authorization                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • Session-based (UUID in frontend)                       │   │
│  │ • IAM roles for Lambda execution                         │   │
│  │ • Least privilege principle                              │   │
│  │ • No hardcoded credentials                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Layer 3: Data Protection                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • API keys in SSM Parameter Store (encrypted)            │   │
│  │ • DynamoDB encryption at rest (AWS KMS)                  │   │
│  │ • S3 images bucket private (signed URLs only)            │   │
│  │ • Signed URLs with 1-hour expiry                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Layer 4: Input Validation                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • XSS prevention (HTML escaping)                         │   │
│  │ • Celebrity keyword filtering (deepfake prevention)      │   │
│  │ • Prompt length limits                                   │   │
│  │ • Required field validation                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Layer 5: Monitoring & Logging                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • CloudWatch Logs (all Lambda invocations)               │   │
│  │ • Error tracking and alerting                            │   │
│  │ • API Gateway access logs                                │   │
│  │ • Audit trail in DynamoDB                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### IAM Roles & Permissions

```
Lambda Execution Roles (Least Privilege)

Chat Handler Role:
├── dynamodb:PutItem (ChatMessages table only)
├── ssm:GetParameter (/chatbot/gemini-api-key only)
└── logs:* (CloudWatch logging)

Image Generator Role:
├── s3:PutObject (images/ prefix only)
├── s3:GetObject (for signed URLs)
├── dynamodb:PutItem (ChatMessages table only)
├── ssm:GetParameter (/chatbot/gemini-api-key only)
└── logs:* (CloudWatch logging)

History Handler Role:
├── dynamodb:Query (ChatMessages table only)
└── logs:* (CloudWatch logging)
```

---

## Scalability & Performance

### Performance Optimizations

```
Frontend:
├── Minimal dependencies (vanilla JS)
├── CSS minification (production)
├── Lazy loading images
├── Debounced input handlers
├── Client-side caching (localStorage)
└── Optimized bundle size (~35KB total)

Backend:
├── Lambda cold start mitigation (lightweight dependencies)
├── DynamoDB on-demand pricing (auto-scaling)
├── S3 signed URLs (CDN-ready)
├── Efficient API calls (batching future)
└── CloudWatch Insights for monitoring
```

### Scalability Features

```
Auto-Scaling Components:
┌────────────────────────────────────────────────────────┐
│ Service         │ Scaling Type  │ Limits              │
├─────────────────┼───────────────┼─────────────────────┤
│ Lambda          │ Auto          │ 1000 concurrent     │
│ API Gateway     │ Auto          │ 10,000 RPS default  │
│ DynamoDB        │ On-Demand     │ Unlimited*          │
│ S3              │ Auto          │ Unlimited           │
└────────────────────────────────────────────────────────┘

* Subject to AWS account limits
```

### Cost Optimization

```
Monthly Cost Breakdown (Estimated for 10,000 requests/month):

┌───────────────────────────────────────────────────────────┐
│ Service          │ Usage               │ Cost            │
├──────────────────┼─────────────────────┼─────────────────┤
│ Lambda           │ 10K invocations     │ $0.00 (Free)    │
│ API Gateway      │ 10K requests        │ $0.01           │
│ DynamoDB         │ 10K writes/reads    │ $0.00 (Free)    │
│ S3 (Frontend)    │ 1K GET requests     │ $0.00 (Free)    │
│ S3 (Images)      │ 100 images          │ $0.00 (Free)    │
│ CloudWatch Logs  │ 1 GB ingestion      │ $0.50           │
├──────────────────┼─────────────────────┼─────────────────┤
│ TOTAL            │                     │ ~$0.51/month    │
└───────────────────────────────────────────────────────────┘

External APIs (Google):
├── Gemini 2.5 Flash: 15 RPM free (1,500/day)
└── Imagen 4.0: Limited free tier

Expected Monthly Cost: < $1.00 (within AWS Free Tier)
```

---

## Technology Stack Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      TECHNOLOGY STACK                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Frontend:                                                        │
│   ├── HTML5 (Semantic markup)                                   │
│   ├── CSS3 (OKLCH color space, Grid, Flexbox)                   │
│   ├── JavaScript ES6+ (Vanilla, no framework)                   │
│   └── Markdown rendering (custom implementation)                │
│                                                                  │
│ Backend (AWS):                                                   │
│   ├── Lambda (Node.js 18.x runtime)                             │
│   ├── API Gateway (HTTP API)                                    │
│   ├── DynamoDB (NoSQL database)                                 │
│   ├── S3 (Object storage)                                       │
│   ├── SSM Parameter Store (Secrets management)                  │
│   └── CloudWatch (Logging & monitoring)                         │
│                                                                  │
│ External Services:                                               │
│   ├── Google Gemini 2.5 Flash (Chat AI)                         │
│   └── Google Imagen 4.0 (Image generation)                      │
│                                                                  │
│ Infrastructure as Code:                                          │
│   ├── Terraform (v1.5+)                                          │
│   ├── Bash scripts (deployment automation)                      │
│   └── Git (version control)                                     │
│                                                                  │
│ Development Tools:                                               │
│   ├── AWS CLI                                                    │
│   ├── Node.js 18+                                                │
│   └── npm (package manager)                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Future Enhancements

```
Planned Features:
├── Authentication (AWS Cognito)
├── User accounts & profiles
├── Rate limiting (API Gateway)
├── CloudFront CDN integration
├── Custom domain (Route 53)
├── Multi-region deployment
├── Cost monitoring (AWS Cost Explorer)
├── Advanced analytics (CloudWatch Insights)
├── WebSocket support (real-time chat)
└── MCP server integrations (Maps, Search, Video)
```

---

## Deployment Architecture

```
Deployment Pipeline:

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Developer   │────►│  Terraform   │────►│   AWS Cloud  │
│  Local Env   │     │   Scripts    │     │   Resources  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       │                    │                     │
    Code                  IaC               Infrastructure
   Changes              Deploy                Created
       │                    │                     │
       ▼                    ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Git Push    │────►│  terraform   │────►│   Lambdas    │
│              │     │    apply     │     │   Updated    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ deploy-      │
                     │ frontend.sh  │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  S3 Sync     │
                     │  Frontend    │
                     └──────────────┘
```

---

## Complete Resource Summary

### AWS Resources Count

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESOURCE INVENTORY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Lambda Functions: 9                                             │
│   ├── chat-handler (256MB, 30s) ✅                              │
│   ├── image-generator (512MB, 60s) ✅                           │
│   ├── video-generator (1024MB, 900s) 🚧                         │
│   ├── get-history (128MB, 10s) ✅                               │
│   ├── function-call (256MB, 30s) 🚧                             │
│   ├── process-document (1024MB, 120s) 🚧                        │
│   ├── web-search (256MB, 30s) 🚧                                │
│   ├── maps-search (256MB, 30s) 🚧                               │
│   └── process-audio (1024MB, 120s) 🚧                           │
│                                                                  │
│ API Gateway: 1                                                   │
│   ├── HTTP API (not REST)                                       │
│   ├── 9 Routes                                                  │
│   ├── 1 Stage (/dev)                                            │
│   └── CORS enabled                                              │
│                                                                  │
│ DynamoDB Tables: 1                                               │
│   ├── ChatMessages-v2                                           │
│   ├── On-Demand pricing                                         │
│   ├── TTL enabled                                               │
│   └── Streams enabled                                           │
│                                                                  │
│ S3 Buckets: 2                                                    │
│   ├── Frontend bucket (public, website hosting)                 │
│   └── Images bucket (private, versioned, lifecycle policy)      │
│                                                                  │
│ SSM Parameters: 2                                                │
│   ├── /chatbot/gemini-api-key (SecureString)                    │
│   └── /chatbot/openweather-api-key (SecureString, optional)     │
│                                                                  │
│ IAM Roles: 1                                                     │
│   └── Lambda execution role (with inline policy)                │
│                                                                  │
│ CloudWatch Log Groups: 9                                         │
│   └── One per Lambda function                                   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ TOTAL TERRAFORM RESOURCES: ~35                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Assets (S3 Static Files)

```
Frontend Structure:
├── index.html (Main UI)
├── css/
│   └── style.css (OKLCH colors, ~35KB)
└── js/
    ├── config.js (API configuration)
    ├── app.js (Main application logic)
    ├── chat.js (Chat module)
    ├── imageGenerator.js (Image generation)
    ├── videoGenerator.js (Video generation) 🚧
    ├── documentProcessor.js (PDF processing) 🚧
    ├── webSearch.js (Web search MCP) 🚧
    ├── mapsSearch.js (Maps search MCP) 🚧
    └── (9 JavaScript modules total)

Total Size: ~60KB (uncompressed)
```

### External Dependencies

```
Google Cloud APIs:
├── Gemini 2.5 Flash (Chat)
│   └── Endpoint: generativelanguage.googleapis.com
│   └── Rate Limit: 15 RPM (free tier)
│
├── Imagen 4.0 (Image Generation)
│   └── Model: imagen-4.0-generate-001
│   └── Response: Base64 encoded PNG
│
└── OpenWeather API (Optional)
    └── Used by function-call Lambda

Node.js Packages (Lambda dependencies):
├── aws-sdk (AWS SDK for JavaScript)
├── uuid (UUID generation)
└── https (built-in, for external API calls)
```

### Estimated Monthly Cost (AWS)

```
Service Breakdown (assuming 10,000 requests/month):

┌────────────────────┬──────────────────┬───────────────┐
│ Service            │ Usage            │ Cost          │
├────────────────────┼──────────────────┼───────────────┤
│ Lambda (9 funcs)   │ 10K invocations  │ $0.00 (Free)  │
│ API Gateway        │ 10K requests     │ $0.01         │
│ DynamoDB           │ 10K reads/writes │ $0.00 (Free)  │
│ S3 (Frontend)      │ 1K GET requests  │ $0.00 (Free)  │
│ S3 (Images)        │ 100 images/30GB  │ $0.00 (Free)  │
│ CloudWatch Logs    │ 1 GB             │ $0.50         │
│ SSM Parameters     │ 2 parameters     │ $0.00         │
│ Data Transfer      │ 5 GB out         │ $0.45         │
├────────────────────┼──────────────────┼───────────────┤
│ **TOTAL**          │                  │ **~$0.96/mo** │
└────────────────────┴──────────────────┴───────────────┘

External APIs (Google):
├── Gemini 2.5 Flash: Free tier (1,500 requests/day)
└── Imagen 4.0: Limited free tier

💡 Within AWS Free Tier: YES (for first 12 months + always-free services)
```

### Security Summary

```
✅ API keys encrypted in SSM Parameter Store (KMS)
✅ DynamoDB encryption at rest (AWS managed)
✅ S3 images bucket private (signed URLs only)
✅ HTTPS enforced (API Gateway)
✅ IAM least privilege (Lambda roles)
✅ CORS properly configured
✅ No hardcoded credentials
✅ Celebrity/deepfake filtering (image generation)
✅ Input validation on all endpoints
✅ XSS prevention (HTML escaping)
```

---

**Document Version:** 1.0
**Last Updated:** 2025
**Maintained By:** Development Team
**Related Documents:** DEPLOYMENT_GUIDE.md, CLAUDE.md, terraform/README.md
