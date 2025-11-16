# 🚀 Serverless Chatbot - Quick Deployment Guide

Complete guide to deploy your AI chatbot using Terraform.

## ✅ What You'll Deploy

- 4 Lambda Functions (Chat, Image Gen, History, Function Calling)
- DynamoDB Table (for messages)
- 2 S3 Buckets (images + frontend)
- API Gateway (HTTP API)
- All with **custom names** to avoid conflicts!

## 📋 What You Need to Provide

### Required Environment Variables:

| Variable | Description | Where to Get | Example |
|----------|-------------|--------------|---------|
| `gemini_api_key` | Google Gemini API Key | https://aistudio.google.com/ | `AIzaSy...` |
| `s3_images_bucket_name` | S3 bucket for images (globally unique) | Choose your own | `chatbot-images-mouad-2024` |
| `s3_frontend_bucket_name` | S3 bucket for frontend (globally unique) | Choose your own | `chatbot-frontend-mouad-2024` |

### Optional Variables:

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `project_name` | Project name (affects Lambda names) | `chatbot-v2` | Change to avoid conflicts |
| `dynamodb_table_name` | DynamoDB table name | `ChatMessages-v2` | Change if you had `ChatMessages` |
| `environment` | Environment name | `dev` | `dev`, `staging`, or `prod` |
| `aws_region` | AWS region | `us-east-1` | Any valid region |
| `openweather_api_key` | OpenWeather API key (optional) | `""` | For weather function |

## 🎯 5-Step Deployment Process

### Step 1: Get Your Gemini API Key

1. Go to https://aistudio.google.com/
2. Click **"Get API Key"**
3. Create a new API key
4. Copy it (you'll need it in Step 2)

### Step 2: Configure Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # or use any editor
```

**Edit `terraform.tfvars` and fill in:**

```hcl
# REQUIRED: Change to avoid conflicts with previous deployments
project_name = "my-chatbot"  # ← Change this!

# REQUIRED: Your Gemini API key
gemini_api_key = "AIzaSy_YOUR_ACTUAL_API_KEY_HERE"  # ← Paste here!

# REQUIRED: Globally unique S3 bucket names
s3_images_bucket_name   = "chatbot-images-mouad-12345"      # ← Change!
s3_frontend_bucket_name = "chatbot-frontend-mouad-12345"    # ← Change!

# Optional: Change if needed
dynamodb_table_name = "ChatMessages-v2"
aws_region = "us-east-1"
environment = "dev"
```

**💡 Naming Tips:**
- S3 buckets must be globally unique across ALL AWS accounts
- Use your name + random numbers: `chatbot-images-john-7849`
- Lowercase letters, numbers, and hyphens only
- No underscores or special characters

### Step 3: Deploy Backend Infrastructure

```bash
cd terraform
./deploy.sh
```

This will:
1. ✅ Check prerequisites
2. ✅ Install Lambda dependencies
3. ✅ Initialize Terraform
4. ✅ Show you what will be created
5. ✅ Ask for confirmation
6. ✅ Deploy everything
7. ✅ Display API URL

**Expected output:**
```
✅ Deployment completed!

API Gateway URL: https://abc123xyz.execute-api.us-east-1.amazonaws.com
```

### Step 4: Deploy Frontend

```bash
./deploy-frontend.sh
```

This will:
1. ✅ Automatically update `frontend/js/config.js` with API URL
2. ✅ Upload frontend to S3
3. ✅ Show you the website URL
4. ✅ Open it in your browser

**Expected output:**
```
✅ Frontend deployed successfully!
🎉 Your chatbot is live!
URL: http://chatbot-frontend-mouad-12345.s3-website-us-east-1.amazonaws.com
```

### Step 5: Test Your Chatbot!

Your chatbot is now live! Try:
- **Regular chat**: "Hello! How are you?"
- **Image generation**: "/image a robot on a skateboard"
- **Weather**: "What's the weather in Paris?"
- **Calculator**: "Calculate 25 * 4"
- **Web search**: "Search for latest AI news"

## 🔧 Customizing Names (Important!)

If you have previous failed deployments or want unique names:

### Change Lambda Function Names

In `terraform.tfvars`:
```hcl
project_name = "my-chatbot"  # Instead of "chatbot-v2"
```

This creates functions named:
- `my-chatbot-dev-chat-handler`
- `my-chatbot-dev-image-generator`
- `my-chatbot-dev-get-history`
- `my-chatbot-dev-function-call`

### Change DynamoDB Table Name

```hcl
dynamodb_table_name = "ChatMessages-MyApp"
```

### Change S3 Bucket Names

```hcl
s3_images_bucket_name   = "my-unique-images-2024"
s3_frontend_bucket_name = "my-unique-frontend-2024"
```

## 📂 Files Created

```
terraform/
├── main.tf                    # Infrastructure definition
├── variables.tf               # Variable definitions
├── outputs.tf                 # Output values
├── terraform.tfvars.example   # Example config
├── terraform.tfvars           # YOUR config (gitignored)
├── deploy.sh                  # Deploy backend script
├── deploy-frontend.sh         # Deploy frontend script
├── .gitignore                 # Ignore sensitive files
└── README.md                  # Detailed documentation
```

## 🐛 Common Issues & Solutions

### Issue 1: "bucket already exists"

**Error:**
```
Error: creating S3 Bucket: BucketAlreadyExists
```

**Solution:** Change bucket names in `terraform.tfvars`:
```hcl
s3_images_bucket_name   = "your-unique-name-12345"
s3_frontend_bucket_name = "your-unique-name-67890"
```

### Issue 2: "table already exists"

**Error:**
```
Error: creating DynamoDB Table: ResourceInUseException
```

**Solution:** Change table name in `terraform.tfvars`:
```hcl
dynamodb_table_name = "ChatMessages-NewName"
```

### Issue 3: "function already exists"

**Error:**
```
Error: creating Lambda Function: ResourceConflictException
```

**Solution:** Change project name in `terraform.tfvars`:
```hcl
project_name = "my-new-chatbot"
```

### Issue 4: "Invalid API key"

**Error:** Lambda logs show "Invalid response from Gemini API"

**Solution:**
1. Go to https://aistudio.google.com/
2. Get a new API key
3. Update `gemini_api_key` in `terraform.tfvars`
4. Run `terraform apply` again

### Issue 5: "CORS error" in browser

**Error:** Frontend shows CORS policy error

**Solution:**
1. Check API URL in `frontend/js/config.js`
2. Run `./deploy-frontend.sh` to auto-update
3. Clear browser cache and reload

## 🔄 Updating Your Deployment

### Update Backend Code

```bash
# After changing Lambda functions
cd terraform
terraform apply
```

### Update Frontend

```bash
# After changing frontend files
cd terraform
./deploy-frontend.sh
```

### Add New Resources

```bash
# After changing terraform files
cd terraform
terraform plan      # Preview changes
terraform apply     # Apply changes
```

## 🗑️ Cleanup / Delete Everything

```bash
cd terraform
terraform destroy
```

**⚠️ Warning:** This deletes:
- All Lambda functions
- DynamoDB table (all data!)
- S3 buckets (all files!)
- API Gateway
- Everything!

## 💰 Cost Estimate

**Within AWS Free Tier:**
- Lambda: $0 (1M requests/month free)
- API Gateway: $0 (1M requests/month free)
- DynamoDB: $0 (25 GB free)
- S3: $0 (5 GB free)
- Gemini API: $0 (15 RPM, 1500 RPD free)

**Total: $0/month** ✅

## 📊 Monitoring After Deployment

### View Logs

```bash
# Get function name
cd terraform
FUNCTION=$(terraform output -json lambda_functions | jq -r '.chat_handler')

# View logs
aws logs tail /aws/lambda/$FUNCTION --follow
```

### Check Resources

```bash
# List all resources
terraform state list

# Show specific resource
terraform state show aws_lambda_function.chat_handler
```

### Test API

```bash
# Get API URL
API_URL=$(terraform output -raw api_gateway_url)

# Test chat
curl -X POST $API_URL/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","sessionId":"test-123"}'
```

## 🎉 Success Checklist

After deployment, you should have:

- [x] API Gateway URL in terminal output
- [x] 4 Lambda functions in AWS Console
- [x] DynamoDB table created
- [x] 2 S3 buckets created
- [x] Frontend website accessible
- [x] Can chat with AI
- [x] Can generate images
- [x] Can use tools (weather, calculator, search)

## 📞 Need Help?

1. Check `terraform/README.md` for detailed docs
2. Run `terraform plan` to preview changes
3. Check AWS Console for resource status
4. Review CloudWatch logs for errors
5. Verify API keys are correct

## 🚀 Next Steps

1. **Customize Frontend**: Edit `frontend/css/style.css` for colors
2. **Add More Tools**: Edit `backend/functions/functionCall/handler.js`
3. **Set Up Monitoring**: Configure CloudWatch alarms
4. **Add Authentication**: Implement AWS Cognito (optional)
5. **Custom Domain**: Set up Route 53 + CloudFront (optional)

---

**Built with ❤️ using Terraform + AWS + Google Gemini**
