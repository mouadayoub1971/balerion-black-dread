# Serverless Chatbot Backend

Backend infrastructure for a serverless AI chatbot using Google Gemini API, AWS Lambda, DynamoDB, and S3.

## Features

- **Chat Handler**: Process messages using Gemini 2.0 Flash
- **Image Generator**: Create images using Google Imagen API
- **Function Calling**: Weather, calculator, and web search tools
- **Chat History**: Store and retrieve conversation history
- **100% Serverless**: Pay only for what you use
- **Free Tier Compatible**: Designed to run within AWS and Google free tiers

## Architecture

```
┌─────────────┐
│   Frontend  │
│  (S3/CDN)   │
└──────┬──────┘
       │
       │ HTTPS
       ▼
┌─────────────────────┐
│   API Gateway       │
│   (HTTP API)        │
└──────┬──────────────┘
       │
       ├──► POST /chat ────────────────────► Chat Handler Lambda
       │                                      │
       ├──► POST /generate-image ───────────► Image Generator Lambda
       │                                      │
       ├──► GET /history/{sessionId} ───────► Get History Lambda
       │                                      │
       └──► POST /function-call ────────────► Function Call Handler Lambda
                                              │
       ┌──────────────────────────────────────┼────────────────────┐
       │                                      │                    │
       ▼                                      ▼                    ▼
  ┌──────────┐                         ┌──────────┐         ┌──────────┐
  │ DynamoDB │                         │    S3    │         │   SSM    │
  │  Table   │                         │  Bucket  │         │Parameter │
  └──────────┘                         └──────────┘         │  Store   │
                                                             └──────────┘
       │                                      │                    │
       └──────────────────────────────────────┴────────────────────┘
                    External APIs: Google Gemini, OpenWeatherMap
```

## Prerequisites

1. **AWS CLI** installed and configured
2. **Node.js** 18.x or higher
3. **npm** or **yarn**
4. **Google Gemini API Key** from https://aistudio.google.com/
5. (Optional) **OpenWeatherMap API Key** from https://openweathermap.org/api

## Setup Instructions

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install function dependencies
npm run install-all
```

### 2. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and fill in your values
nano .env  # or use any text editor
```

Required variables:
- `AWS_REGION`: Your AWS region (e.g., us-east-1)
- `AWS_ACCOUNT_ID`: Your 12-digit AWS account ID
- `GEMINI_API_KEY`: Your Google Gemini API key

### 3. Store API Keys in AWS SSM

```bash
# Store Gemini API key securely
aws ssm put-parameter \
  --name "/chatbot/gemini-api-key" \
  --value "YOUR_GEMINI_API_KEY" \
  --type SecureString \
  --region us-east-1

# Verify it was stored
aws ssm get-parameter \
  --name "/chatbot/gemini-api-key" \
  --with-decryption \
  --region us-east-1
```

### 4. Deploy to AWS

```bash
# Deploy all resources (Lambda, API Gateway, DynamoDB, S3)
npm run deploy

# Or with Serverless Framework directly
serverless deploy --stage dev
```

The deployment will:
- Create DynamoDB table
- Create S3 bucket for images
- Deploy 4 Lambda functions
- Set up API Gateway HTTP API
- Configure IAM roles and policies

### 5. Get API Endpoint

After deployment, you'll see output like:

```
endpoints:
  POST - https://abc123xyz.execute-api.us-east-1.amazonaws.com/chat
  POST - https://abc123xyz.execute-api.us-east-1.amazonaws.com/generate-image
  GET  - https://abc123xyz.execute-api.us-east-1.amazonaws.com/history/{sessionId}
  POST - https://abc123xyz.execute-api.us-east-1.amazonaws.com/function-call
```

Copy the base URL (e.g., `https://abc123xyz.execute-api.us-east-1.amazonaws.com`) - you'll need it for the frontend.

## Lambda Functions

### 1. Chat Handler (`functions/chat/`)
- **Endpoint**: `POST /chat`
- **Purpose**: Process chat messages using Gemini API
- **Payload**:
  ```json
  {
    "message": "Hello, how are you?",
    "sessionId": "user-session-123"
  }
  ```

### 2. Image Generator (`functions/generateImage/`)
- **Endpoint**: `POST /generate-image`
- **Purpose**: Generate images using Google Imagen
- **Payload**:
  ```json
  {
    "prompt": "A robot holding a red skateboard",
    "sessionId": "user-session-123"
  }
  ```

### 3. Get History (`functions/getHistory/`)
- **Endpoint**: `GET /history/{sessionId}`
- **Purpose**: Retrieve conversation history
- **Example**: `GET /history/user-session-123`

### 4. Function Call Handler (`functions/functionCall/`)
- **Endpoint**: `POST /function-call`
- **Purpose**: Execute tools via Gemini function calling
- **Available Tools**:
  - `get_weather`: Get weather for a location
  - `calculate`: Perform math calculations
  - `search_web`: Search the web with DuckDuckGo
- **Payload**:
  ```json
  {
    "message": "What's the weather in Paris?",
    "sessionId": "user-session-123"
  }
  ```

## Testing

### Test Chat Endpoint

```bash
curl -X POST https://YOUR_API_ENDPOINT/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! Tell me a joke.",
    "sessionId": "test-123"
  }'
```

### Test Image Generation

```bash
curl -X POST https://YOUR_API_ENDPOINT/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A futuristic city at sunset",
    "sessionId": "test-123"
  }'
```

### Test Function Calling

```bash
curl -X POST https://YOUR_API_ENDPOINT/function-call \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is 25 * 4?",
    "sessionId": "test-123"
  }'
```

### Test Get History

```bash
curl https://YOUR_API_ENDPOINT/history/test-123
```

## Monitoring

### View Logs

```bash
# Chat handler logs
npm run logs-chat

# Image generator logs
npm run logs-image

# History logs
npm run logs-history

# Function calling logs
npm run logs-function

# Or use AWS CLI
aws logs tail /aws/lambda/dev-chatbot-chat --follow
```

### Check DynamoDB

```bash
# Scan table
aws dynamodb scan --table-name ChatMessages-dev

# Query specific session
aws dynamodb query \
  --table-name ChatMessages-dev \
  --key-condition-expression "sessionId = :sid" \
  --expression-attribute-values '{":sid":{"S":"test-123"}}'
```

### Check S3 Images

```bash
# List images
aws s3 ls s3://chatbot-images-dev-YOUR_ACCOUNT_ID/images/

# Download image
aws s3 cp s3://chatbot-images-dev-YOUR_ACCOUNT_ID/images/IMAGE_NAME.png ./
```

## Cost Optimization

### Free Tier Limits
- **Lambda**: 1M requests/month, 400,000 GB-seconds
- **API Gateway**: 1M HTTP API calls/month
- **DynamoDB**: 25 GB storage, on-demand pricing included
- **S3**: 5 GB storage, 20,000 GET, 2,000 PUT requests
- **Gemini API**: 15 requests/minute, 1,500 requests/day

### Tips
1. **Set image expiration**: Images auto-delete after 30 days (configured in serverless.yml)
2. **Monitor usage**: Check AWS Cost Explorer regularly
3. **Set billing alerts**: Configure AWS Budget alerts
4. **Use on-demand pricing**: DynamoDB PAY_PER_REQUEST mode is cost-effective for low traffic
5. **Optimize Lambda memory**: Start with 256MB, adjust based on CloudWatch metrics

## Troubleshooting

### Lambda Timeout
```
Error: Task timed out after 30.00 seconds
```
**Solution**: Increase timeout in serverless.yml or optimize API calls

### API Key Error
```
Error: Invalid response from Gemini API
```
**Solution**: Verify API key in SSM Parameter Store

### Permission Denied
```
Error: User is not authorized to perform: ssm:GetParameter
```
**Solution**: Check IAM role permissions in serverless.yml

### CORS Error
```
Access to fetch blocked by CORS policy
```
**Solution**: Ensure `cors: true` is set in serverless.yml events

## Cleanup

To delete all resources:

```bash
# Remove all AWS resources
npm run remove

# Or with Serverless Framework
serverless remove --stage dev

# Delete SSM parameters
aws ssm delete-parameter --name "/chatbot/gemini-api-key"
```

## Local Development

```bash
# Install serverless-offline plugin
npm install --save-dev serverless-offline

# Run locally
serverless offline start

# Test local endpoint
curl http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "sessionId": "local-test"}'
```

## Project Structure

```
backend/
├── functions/
│   ├── chat/
│   │   ├── handler.js          # Chat handler code
│   │   └── package.json        # Dependencies
│   ├── generateImage/
│   │   ├── handler.js          # Image generation code
│   │   └── package.json
│   ├── getHistory/
│   │   ├── handler.js          # History retrieval code
│   │   └── package.json
│   └── functionCall/
│       ├── handler.js          # Function calling code
│       └── package.json
├── layers/                     # Shared dependencies (optional)
├── .env.example               # Environment variables template
├── serverless.yml             # Infrastructure as Code
├── package.json               # Root dependencies
└── README.md                  # This file
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `AWS_REGION` | AWS deployment region | Yes |
| `AWS_ACCOUNT_ID` | AWS account ID | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `DYNAMODB_TABLE` | DynamoDB table name | Auto |
| `S3_BUCKET` | S3 bucket for images | Auto |
| `OPENWEATHER_API_KEY` | Weather API key | No |

## Support

For issues and questions:
- Check `../tasks.md` for detailed setup guide
- Review CloudWatch logs for errors
- Verify AWS resource creation in AWS Console
- Check API quotas in Google AI Studio

## License

MIT
