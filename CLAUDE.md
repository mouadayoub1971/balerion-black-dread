# CLAUDE.md - Serverless AI Chatbot

This file provides context for future Claude instances working on this serverless AI chatbot application.

## Project Overview

A fully serverless AI chatbot built with AWS Lambda, DynamoDB, S3, API Gateway, and Google Gemini APIs. Features chat (Gemini 2.5 Flash) and image generation (Imagen 4.0). Infrastructure managed via Terraform with automated deployment scripts.

**Key Constraint**: All resource names must be configurable via Terraform variables because user had previous failed deployments and needs to avoid naming conflicts.

## Quick Start Commands

```bash
# Deploy backend infrastructure
cd terraform
chmod +x deploy.sh deploy-frontend.sh
./deploy.sh

# Deploy frontend (after backend is deployed)
./deploy-frontend.sh

# Redeploy after code changes
terraform apply                # Backend changes
./deploy-frontend.sh           # Frontend changes

# View logs
aws logs tail /aws/lambda/chatbot-v2-dev-chat-handler --follow

# Destroy everything
terraform destroy
```

## Architecture

### Lambda Functions (9 total)
1. **chat-handler**: Process messages with Gemini 2.5 Flash (256MB, 30s timeout)
2. **image-generator**: Generate images with Imagen 4.0 (512MB, 60s timeout)
3. **video-generator**: Generate videos with Imagen/Veo (1024MB, 900s timeout)
4. **get-history**: Retrieve chat history from DynamoDB (128MB, 10s timeout)
5. **function-call**: Handle tool calls (weather, calculator, search) (256MB, 30s timeout)
6. **process-document**: Process PDFs with Gemini (1024MB, 120s timeout)
7. **web-search**: MCP web search integration (256MB, 30s timeout)
8. **maps-search**: MCP maps/location search (256MB, 30s timeout)
9. **process-audio**: Audio processing with Gemini (1024MB, 120s timeout)

**Naming Convention**: `{project_name}-{environment}-{function}`
- Example: `chatbot-v2-dev-chat-handler`
- User can change `project_name` in `terraform.tfvars` to avoid conflicts

**Currently Active Functions**: chat-handler, image-generator, get-history
**In Development**: video-generator, process-document, web-search, maps-search, process-audio, function-call

### API Gateway
- **Type**: HTTP API (cheaper than REST API)
- **CRITICAL**: URL format is `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`
  - Stage is `/dev` by default
  - Frontend config MUST include the stage path: `.../dev`
  - Outputs now automatically include stage in URL

**API Routes** (9 endpoints total):
| Route | Method | Lambda Function | Status |
|-------|--------|----------------|--------|
| `/chat` | POST | chat-handler | ✅ Active |
| `/generate-image` | POST | image-generator | ✅ Active |
| `/generate-video` | POST | video-generator | 🚧 Dev |
| `/history/{sessionId}` | GET | get-history | ✅ Active |
| `/function-call` | POST | function-call | 🚧 Dev |
| `/process-document` | POST | process-document | 🚧 Dev |
| `/web-search` | POST | web-search | 🚧 Dev |
| `/maps-search` | POST | maps-search | 🚧 Dev |
| `/process-audio` | POST | process-audio | 🚧 Dev |

**CORS Configuration**:
```hcl
cors_configuration {
  allow_origins     = ["*"]
  allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"]
  allow_headers     = ["*"]          # Critical - must allow all headers
  expose_headers    = ["*"]
  max_age           = 300
  allow_credentials = false
}
```

### DynamoDB
- **Table**: Configurable via `dynamodb_table_name` (default: `ChatMessages-v2`)
- **Schema**:
  - `sessionId` (STRING) - HASH key (Partition Key)
  - `timestamp` (NUMBER) - RANGE key (Sort Key)
  - `userMessage` (STRING)
  - `aiResponse` (STRING)
  - `type` (STRING) - "chat", "image", "video", "document", "audio", "function_call"
  - `imageUrl` (STRING) - for image generation results
  - `imageKey` (STRING) - S3 object key for images
  - `filename` (STRING) - generated filename
  - `prompt` (STRING) - image/video generation prompt
  - `ttl` (NUMBER) - Time To Live attribute for automatic deletion
- **Billing**: PAY_PER_REQUEST (on-demand, free tier friendly)
- **Features**:
  - TTL enabled (automatic data expiration)
  - DynamoDB Streams enabled (NEW_AND_OLD_IMAGES view type)
  - Encryption at rest (AWS managed keys)

### S3 Buckets
1. **Images Bucket** (also stores videos, documents, audio):
   - Stores generated images, videos, and processed files
   - Private with signed URLs (1-hour expiry)
   - Name must be globally unique: `s3_images_bucket_name` in tfvars
   - **Features**:
     - Versioning enabled (track file changes)
     - Lifecycle policy: Delete objects after 30 days
     - CORS enabled (for frontend uploads)
     - Public access blocked (all 4 settings)
     - Server-side encryption enabled

2. **Frontend Bucket**:
   - Static website hosting (S3 website endpoint)
   - Public read access (bucket policy allows GetObject)
   - Name must be globally unique: `s3_frontend_bucket_name` in tfvars
   - **Features**:
     - Website hosting enabled
     - Index document: index.html
     - Error document: index.html (SPA support)
     - Public access allowed for website hosting

### File Structure
```
serverless-app-/
├── backend/
│   └── functions/
│       ├── chat/handler.js              # Gemini 2.5 Flash integration
│       ├── generateImage/handler.js     # Imagen 4.0 integration
│       ├── generateVideo/handler.js     # Video generation (Veo)
│       ├── getHistory/handler.js        # DynamoDB query
│       ├── functionCall/handler.js      # Tool calling (weather, calculator, search)
│       ├── processDocument/handler.js   # PDF processing with Gemini
│       ├── webSearch/handler.js         # MCP web search
│       ├── mapsSearch/handler.js        # MCP maps search
│       └── processAudio/handler.js      # Audio processing
├── frontend/
│   ├── index.html                       # Main UI (element IDs critical!)
│   ├── css/style.css                    # HSL-based theming
│   └── js/
│       ├── config.js                    # API config & validation
│       ├── app.js                       # Main app logic & theme toggle
│       ├── chat.js                      # Chat module
│       └── imageGenerator.js            # Image generation module
├── terraform/
│   ├── main.tf                          # Infrastructure definition
│   ├── variables.tf                     # Variable definitions
│   ├── outputs.tf                       # Output values
│   ├── terraform.tfvars.example         # Example config
│   ├── terraform.tfvars                 # USER CONFIG (gitignored)
│   ├── deploy.sh                        # Backend deployment script
│   └── deploy-frontend.sh               # Frontend deployment script
├── DEPLOYMENT_GUIDE.md                  # User-facing deployment guide
└── CLAUDE.md                            # This file
```

## Key Technical Details

### Google Gemini 2.5 Flash (Chat)
**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

**System Instruction** (backend/functions/chat/handler.js:98-102):
```javascript
systemInstruction: {
  parts: [{
    text: "You are a helpful AI assistant. If the user asks you to generate, create, or make an image, DO NOT try to describe or generate images in text. Instead, tell them: 'To generate images, please use the /image command. For example: /image sunset over mountains'"
  }]
}
```
**Why**: Prevents AI from trying to describe images in text; directs users to proper `/image` command

**Request Format**:
```javascript
{
  contents: [{ parts: [{ text: message }] }],
  systemInstruction: { parts: [{ text: "..." }] }
}
```

**Response Path**: `response.candidates[0].content.parts[0].text`

### Google Imagen 4.0 (Image Generation)
**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`

**CRITICAL**: Must use `imagen-4.0-generate-001`, NOT `imagen-3.0-generate-001` (deprecated)

**Request Format** (backend/functions/generateImage/handler.js:93-103):
```javascript
{
  instances: [{
    prompt: userPrompt
  }],
  parameters: {
    sampleCount: 1,
    aspectRatio: "1:1",
    safetyFilterLevel: "block_some",
    personGeneration: "allow_all"
  }
}
```

**Response Path**: `response.predictions[0].bytesBase64Encoded`
- Returns base64-encoded image
- Must decode and save to S3
- Generate signed URL with 1-hour expiry

### Frontend Design System (TGIM-CAP)

**User explicitly requested** "option b" redesign using HSL-based CSS variables from `frontend/ui-ux-style.md`.

**Color System** (frontend/css/style.css:1-31):
```css
:root.light, :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 0 36% 36%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --muted: 240 4.8% 95.9%;
    --accent: 240 4.8% 95.9%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.75rem;
}

:root.dark {
    --background: 20 14.3% 4.1%;
    --foreground: 0 0% 95%;
    --card: 24 9.8% 10%;
    /* ... */
}
```

**Usage**: `background-color: hsl(var(--background));`

**Dark Mode Toggle** (frontend/js/app.js:48-56):
```javascript
toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.className;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.className = newTheme;
    localStorage.setItem('theme', newTheme);
    console.log(`🎨 Theme switched to: ${newTheme}`);
}
```

**CRITICAL Element IDs** (frontend/index.html):
- `welcomeScreen` (NOT welcomeCard)
- `messagesContainer` (NOT messagesArea)
- `sessionId` (NOT sessionDisplay)

These MUST match JavaScript expectations or you'll get null reference errors.

## Terraform Configuration

### Required Variables (terraform/terraform.tfvars)
```hcl
# REQUIRED: Get from https://aistudio.google.com/
gemini_api_key = "AIzaSy_YOUR_ACTUAL_API_KEY_HERE"

# REQUIRED: Must be globally unique across ALL AWS accounts
s3_images_bucket_name   = "chatbot-images-yourusername-12345"
s3_frontend_bucket_name = "chatbot-frontend-yourusername-12345"
```

### Optional Variables (for avoiding conflicts)
```hcl
# Change these if you have naming conflicts from previous deployments
project_name        = "chatbot-v2"      # Affects Lambda names
dynamodb_table_name = "ChatMessages-v2" # DynamoDB table name
environment         = "dev"             # Environment suffix
aws_region          = "us-east-1"       # AWS region
openweather_api_key = ""                # Optional - for weather function
```

### Deployment Scripts

**deploy.sh** (terraform/deploy.sh):
1. Checks prerequisites (Terraform, AWS CLI, Node.js)
2. Installs Lambda dependencies (`npm install` in each function directory)
3. Runs `terraform init`
4. Runs `terraform plan`
5. Runs `terraform apply` (asks for confirmation)
6. Displays API Gateway URL

**deploy-frontend.sh** (terraform/deploy-frontend.sh):
1. Extracts S3 frontend bucket name from Terraform outputs
2. Extracts API Gateway URL (with `/dev` stage)
3. Updates `frontend/js/config.js` with correct API URL using `sed`
4. Syncs frontend files to S3: `aws s3 sync ../frontend/ s3://{bucket}/`
5. Displays website URL and opens in browser

**CRITICAL**: `deploy-frontend.sh` uses `sed` to replace ALL occurrences of placeholder URL. This caused a bug where it replaced the URL in validation functions too. Fixed by changing validation to check for placeholder keywords instead of specific URLs.

## Common Issues & Solutions

### Issue 1: API Configuration Validation Bug
**Symptom**: Frontend shows "⚠️ IMPORTANT: API Not Configured" even though API URL is set correctly

**Root Cause**: Validation function was checking if URL equals user's actual API URL as the placeholder

**Fix** (frontend/js/config.js:13-23):
```javascript
CONFIG.isApiConfigured = function() {
    if (!this.API_BASE_URL || this.API_BASE_URL === '') {
        return false;
    }
    // Check for placeholder keywords instead of specific URLs
    if (this.API_BASE_URL.includes('YOUR_API_GATEWAY_URL') ||
        this.API_BASE_URL.includes('YOUR_API') ||
        this.API_BASE_URL.includes('PLACEHOLDER')) {
        return false;
    }
    return this.API_BASE_URL.startsWith('https://');
};
```

**Why it happened**: `deploy-frontend.sh` was replacing ALL occurrences with `sed`, including in validation functions.

### Issue 2: CORS Policy Blocked
**Symptom**:
```
Access to fetch blocked by CORS policy: Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present
```

**Root Cause**: API Gateway CORS configuration was too restrictive

**Fix** (terraform/main.tf - API Gateway CORS):
```hcl
cors_configuration {
  allow_origins     = ["*"]
  allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"]
  allow_headers     = ["*"]          # Must allow ALL headers
  expose_headers    = ["*"]
  max_age           = 300
  allow_credentials = false
}
```

**Also ensure**: All Lambda functions return CORS headers:
```javascript
headers: {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
}
```

### Issue 3: Missing `/dev` Stage in API URL
**Symptom**: 404 Not Found when calling API endpoints, CORS preflight failing

**Root Cause**: API Gateway requires stage path in URL but frontend config had base URL without stage

**Verification**:
```bash
# This fails with 404
curl https://y34yf528ad.execute-api.us-east-1.amazonaws.com/chat

# This works
curl https://y34yf528ad.execute-api.us-east-1.amazonaws.com/dev/chat
```

**Fix**:
1. Update `frontend/js/config.js`:
```javascript
API_BASE_URL: 'https://y34yf528ad.execute-api.us-east-1.amazonaws.com/dev'
```

2. Update `terraform/outputs.tf` to include stage by default:
```hcl
output "api_gateway_url" {
  description = "API Gateway base URL with stage (use this in frontend config.js)"
  value       = "${aws_apigatewayv2_api.chatbot.api_endpoint}/${aws_apigatewayv2_stage.chatbot.name}"
}
```

### Issue 4: Image Generation 500 Error
**Symptom**: `POST .../dev/generate-image 500 (Internal Server Error)`

**Root Cause**: Lambda was using wrong Imagen model version (imagen-3.0 instead of imagen-4.0)

**Fix** (backend/functions/generateImage/handler.js:107):
```javascript
const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: '/v1beta/models/imagen-4.0-generate-001:predict',  // Changed from 3.0 to 4.0
  method: 'POST',
  // ...
};
```

**Verification**: Test with curl:
```bash
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instances":[{"prompt":"a cat"}],"parameters":{"sampleCount":1}}'
```

### Issue 5: JavaScript Element ID Mismatch
**Symptom**: `Uncaught TypeError: Cannot read properties of null (reading 'appendChild')`

**Root Cause**: HTML redesign used different element IDs than JavaScript expected

**Fix**: Changed HTML IDs to match JavaScript (frontend/index.html):
- Line 54: `id="welcomeScreen"` (was `welcomeCard`)
- Line 92: `id="messagesContainer"` (was `messagesArea`)
- Line 122: `id="sessionId"` (was `sessionDisplay`)

**Prevention**: Always check JavaScript for element ID references before changing HTML IDs.

### Issue 6: IAM Permission Denied
**Symptom**:
```
User is not authorized to perform: ssm:PutParameter
User is not authorized to perform: lambda:TagResource
User is not authorized to perform: apigateway:POST
```

**Fix**: Attach PowerUserAccess policy to IAM user:
```bash
aws iam attach-user-policy --user-name terrafrom --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

Or create custom policy with required permissions.

### Issue 7: SSM Parameter Already Exists
**Symptom**: `The parameter already exists. To overwrite this value, set the overwrite option to true`

**Fix Option 1**: Delete existing parameter:
```bash
aws ssm delete-parameter --name /chatbot/gemini-api-key
```

**Fix Option 2**: Import into Terraform state:
```bash
terraform import aws_ssm_parameter.gemini_api_key /chatbot/gemini-api-key
```

**Note**: If using Git Bash, paths get converted (e.g., `/chatbot/key` becomes `C:/Program Files/Git/chatbot/key`). Use PowerShell or CMD instead.

### Issue 8: Resource Naming Conflicts
**Symptom**: `ResourceInUseException: Table already exists` or `Function already exists`

**Fix**: Change resource names in `terraform/terraform.tfvars`:
```hcl
project_name        = "my-unique-chatbot"     # Changes Lambda names
dynamodb_table_name = "ChatMessages-MyApp"    # Changes table name
s3_images_bucket_name   = "my-images-12345"   # Must be globally unique
s3_frontend_bucket_name = "my-frontend-12345" # Must be globally unique
```

Then run `terraform apply` again.

## Testing the Application

### Test Chat Endpoint
```bash
API_URL="https://y34yf528ad.execute-api.us-east-1.amazonaws.com/dev"

curl -X POST $API_URL/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me a joke","sessionId":"test-123"}'
```

**Expected Response**:
```json
{
  "response": "Why did the developer...",
  "timestamp": 1234567890,
  "sessionId": "test-123"
}
```

### Test Image Generation
```bash
curl -X POST $API_URL/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a calm sea with birds flying","sessionId":"test-123"}'
```

**Expected Response**:
```json
{
  "imageUrl": "https://chatbot-images-v2-12345.s3.amazonaws.com/images/...",
  "prompt": "a calm sea with birds flying",
  "timestamp": 1234567890,
  "sessionId": "test-123"
}
```

### Test History Retrieval
```bash
curl "$API_URL/history?sessionId=test-123"
```

**Expected Response**:
```json
{
  "sessionId": "test-123",
  "count": 2,
  "messages": [
    {
      "timestamp": 1234567890,
      "userMessage": "Tell me a joke",
      "aiResponse": "Why did the developer...",
      "type": "chat"
    },
    {
      "timestamp": 1234567891,
      "prompt": "a calm sea with birds flying",
      "imageUrl": "https://...",
      "type": "image"
    }
  ]
}
```

## Frontend Implementation Details

### Message Display (frontend/js/chat.js)
The chat module handles displaying messages with proper formatting:

**User Messages**:
```html
<div class="message user-message">
  <div class="message-content">User text here</div>
  <div class="message-time">12:34 PM</div>
</div>
```

**AI Messages**:
```html
<div class="message ai-message">
  <div class="message-content">AI response here</div>
  <div class="message-time">12:34 PM</div>
</div>
```

**Image Messages**:
```html
<div class="message ai-message image-message">
  <div class="message-content">
    <img src="signed-url" alt="Generated image" class="generated-image">
    <p class="image-caption">Prompt: a calm sea...</p>
  </div>
  <div class="message-time">12:34 PM</div>
</div>
```

### Auto-resize Textarea (frontend/js/app.js:117-123)
```javascript
adjustTextareaHeight() {
    const textarea = this.elements.messageInput;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = newHeight + 'px';
}
```

### Quick Prompt Chips (frontend/index.html:77-88)
```html
<div class="quick-prompts">
    <p class="quick-prompts-label">Try asking:</p>
    <button class="prompt-chip" data-prompt="Tell me a joke">
        😄 Tell me a joke
    </button>
    <button class="prompt-chip" data-prompt="/image a calm sea with birds flying">
        🎨 Generate a sea image
    </button>
    <button class="prompt-chip" data-prompt="Write a haiku about coding">
        ✍️ Write a haiku about coding
    </button>
</div>
```

Click handler (frontend/js/app.js:97-103):
```javascript
document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        const prompt = e.target.dataset.prompt;
        this.elements.messageInput.value = prompt;
        this.sendMessage();
    });
});
```

## Function Calling (Disabled)

The function calling feature exists but is **CURRENTLY DISABLED** in the frontend due to 500 errors.

**Location**: `backend/functions/functionCall/handler.js`

**Available Tools**:
1. **get_weather**: Get weather for a city using OpenWeather API
2. **calculate**: Evaluate mathematical expressions
3. **search_web**: Perform web searches (mock implementation)

**Gemini Function Declaration Format**:
```javascript
{
  name: "get_weather",
  description: "Get current weather information for a city",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "City name"
      }
    },
    required: ["city"]
  }
}
```

**Why Disabled**: Lambda was returning 500 errors. The implementation exists but frontend bypasses it:
```javascript
// frontend/js/chat.js - Disabled function calling
// const response = await ChatModule.sendMessageWithTools(message, this.sessionId);
const response = await ChatModule.sendMessage(message, this.sessionId);
```

**To Re-enable**:
1. Debug Lambda errors by checking CloudWatch logs
2. Fix any API issues in `backend/functions/functionCall/handler.js`
3. Uncomment function calling code in `frontend/js/chat.js`
4. Redeploy: `terraform apply && ./deploy-frontend.sh`

## Cost Optimization (Free Tier)

**Lambda**:
- 1M requests/month free
- 400,000 GB-seconds compute free
- All functions use 128MB memory (minimum)

**API Gateway**:
- 1M API calls/month free (first 12 months)

**DynamoDB**:
- 25 GB storage free
- 25 WCU, 25 RCU free
- Using on-demand pricing (pay per request)

**S3**:
- 5 GB storage free
- 20,000 GET requests free
- 2,000 PUT requests free

**Google Gemini**:
- Gemini 2.5 Flash: 15 requests/minute free (1500/day)
- Imagen 4.0: Limited free tier

**Total Expected Cost**: $0/month for typical usage

## Security Best Practices

1. ✅ **API Keys Encrypted**: Stored in SSM Parameter Store with `SecureString` type
2. ✅ **S3 Images Private**: Bucket has `acl = "private"`, uses signed URLs with 1-hour expiry
3. ✅ **S3 Frontend Public**: Required for static website hosting, no sensitive data
4. ✅ **IAM Least Privilege**: Lambda execution roles only have permissions they need
5. ✅ **DynamoDB Encryption**: Enabled by default for DynamoDB tables
6. ✅ **HTTPS Enforced**: API Gateway only accepts HTTPS
7. ✅ **terraform.tfvars Gitignored**: Contains API keys, never committed to git

**Warning**: `terraform.tfvars` contains sensitive API keys. Never commit this file or share it.

## Debugging Tips

### View Lambda Logs
```bash
# Get function name from Terraform
cd terraform
FUNCTION=$(terraform output -json lambda_functions | jq -r '.chat_handler')

# View logs in real-time
aws logs tail /aws/lambda/$FUNCTION --follow

# View logs from last 5 minutes
aws logs tail /aws/lambda/$FUNCTION --since 5m
```

### Check API Gateway Stages
```bash
# Get API ID
API_ID=$(terraform output -raw api_gateway_id)

# List stages
aws apigatewayv2 get-stages --api-id $API_ID

# Get routes
aws apigatewayv2 get-routes --api-id $API_ID
```

### Check DynamoDB Items
```bash
# Scan table (limit 10 items)
aws dynamodb scan --table-name ChatMessages-v2 --max-items 10

# Query by session ID
aws dynamodb query --table-name ChatMessages-v2 \
  --key-condition-expression "sessionId = :sid" \
  --expression-attribute-values '{":sid":{"S":"test-123"}}'
```

### Check S3 Buckets
```bash
# List images
aws s3 ls s3://chatbot-images-v2-12345/images/

# Get bucket size
aws s3 ls s3://chatbot-images-v2-12345 --recursive --summarize | grep "Total Size"
```

### Test CORS
```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: http://chatbot-frontend-v2-12345.s3-website-us-east-1.amazonaws.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -i \
  https://y34yf528ad.execute-api.us-east-1.amazonaws.com/dev/chat
```

Expected headers in response:
```
access-control-allow-origin: *
access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS,HEAD
access-control-allow-headers: *
```

## User Preferences & Constraints

**From conversation history**:

1. **Naming Flexibility Required**: User has previous failed deployments and MUST be able to change all resource names via Terraform variables

2. **Free Tier Optimization**: User wants to stay within free tiers ($0/month)

3. **Google Gemini Provider**: User explicitly chose Google Gemini (not OpenAI, Anthropic, etc.)
   - Has access to Gemini 2.5 Flash for chat
   - Has access to Imagen 4.0 for images

4. **No MCP Servers**: User explicitly requested to "delete the mcp and replaced with Function Calling with Gemini"

5. **UI/UX Style**: User explicitly chose "option b" - complete redesign with:
   - HSL-based CSS variables (from `frontend/ui-ux-style.md`)
   - Card-based layout
   - Dark mode toggle
   - Clean design (no gradients)
   - TGIM-CAP design system

6. **Vanilla JavaScript**: No frameworks - user wants simple static frontend

7. **Automated Deployment**: User wanted bash scripts for deployment automation

## Known Limitations

1. **Function Calling Disabled**: Tool calling (weather, calculator, search) returns 500 errors - implementation exists but is disabled in frontend

2. **Image URLs Expire**: Generated image signed URLs expire after 1 hour - users can't bookmark or share links long-term

3. **No Authentication**: Anyone with the frontend URL can use the chatbot - no user accounts or rate limiting

4. **Session Storage**: Session IDs are client-generated (UUID) - no server-side session management

5. **No Message Persistence in UI**: Refreshing the page clears chat history (though it's stored in DynamoDB)

6. **Single Region**: Deployed to single AWS region (us-east-1 by default) - no multi-region redundancy

## Future Enhancement Ideas

1. **Add Authentication**: Implement AWS Cognito for user accounts
2. **Add Rate Limiting**: Prevent abuse with API Gateway throttling
3. **Custom Domain**: Set up Route 53 + CloudFront for custom domain
4. **Persistent Chat UI**: Load chat history from DynamoDB on page load
5. **Fix Function Calling**: Debug and re-enable tool access
6. **Multi-region**: Deploy to multiple regions for redundancy
7. **Monitoring**: Set up CloudWatch alarms for errors
8. **Cost Tracking**: Implement AWS Cost Explorer tags

## Deployment Checklist

Before deploying:
- [ ] Terraform installed (`terraform --version`)
- [ ] AWS CLI configured (`aws configure`)
- [ ] Node.js installed (`node --version`)
- [ ] Gemini API key obtained from https://aistudio.google.com/
- [ ] Unique S3 bucket names chosen (globally unique!)
- [ ] `terraform/terraform.tfvars` created from example
- [ ] All required variables filled in tfvars

After deploying:
- [ ] API Gateway URL shown in output
- [ ] 4 Lambda functions created
- [ ] DynamoDB table created
- [ ] 2 S3 buckets created
- [ ] Frontend website accessible
- [ ] Chat functionality works
- [ ] Image generation works
- [ ] Dark mode toggle works

## Documentation Files

- **DEPLOYMENT_GUIDE.md**: User-facing deployment guide with 5-step process
- **terraform/README.md**: Detailed Terraform documentation
- **frontend/ui-ux-style.md**: Complete TGIM-CAP design system reference (1730 lines)
- **tasks.md**: 8-phase deployment checklist
- **CLAUDE.md**: This file - context for Claude instances

## Final Notes

This project is **fully functional** for chat and image generation. The user successfully deployed it and was able to chat with Gemini 2.5 Flash and generate images with Imagen 4.0.

**User's Last Request**: "/init + add what you need so the next you will have context"

This CLAUDE.md file provides comprehensive context for future Claude instances to:
- Understand the architecture
- Avoid known pitfalls (CORS, API paths, element IDs, etc.)
- Quickly resume development
- Reference user preferences and constraints
- Debug issues efficiently

**Key Success Metric**: Application deployed at $0/month cost within AWS and Google Gemini free tiers.
