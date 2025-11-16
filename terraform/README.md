# Terraform Deployment for Serverless Chatbot

Automated infrastructure deployment using Terraform with **configurable names to avoid conflicts**.

## 🎯 What This Deploys

- ✅ 4 Lambda Functions (with unique names)
- ✅ DynamoDB Table (customizable name)
- ✅ 2 S3 Buckets (globally unique names)
- ✅ API Gateway HTTP API
- ✅ IAM Roles & Policies
- ✅ SSM Parameters (encrypted API keys)

## 📋 Prerequisites

1. **Terraform** installed (`terraform --version`)
2. **AWS CLI** configured (`aws configure`)
3. **Google Gemini API Key** from https://aistudio.google.com/
4. **Node.js** (for Lambda dependencies)

## 🚀 Quick Start (5 Steps)

### Step 1: Configure Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # or use any text editor
```

### Step 2: Fill Required Variables

Edit `terraform.tfvars` and set:

```hcl
# REQUIRED: Change these to avoid conflicts!
project_name = "chatbot-v2"  # Make this unique!

# REQUIRED: Get from https://aistudio.google.com/
gemini_api_key = "YOUR_ACTUAL_GEMINI_API_KEY"

# REQUIRED: Must be globally unique!
s3_images_bucket_name   = "chatbot-images-mouad-12345"
s3_frontend_bucket_name = "chatbot-frontend-mouad-12345"

# Optional: Change if you had naming conflicts
dynamodb_table_name = "ChatMessages-v2"
```

**🔑 Where to Get API Keys:**
- **Gemini API Key**: https://aistudio.google.com/ → Click "Get API Key"
- **OpenWeather (Optional)**: https://openweathermap.org/api

### Step 3: Deploy Infrastructure

```bash
# Option A: Automated script (recommended)
chmod +x deploy.sh
./deploy.sh

# Option B: Manual commands
terraform init
terraform plan
terraform apply
```

### Step 4: Deploy Frontend

```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

### Step 5: Open Your Chatbot

The script will output the website URL and open it in your browser!

## 📝 Environment Variables You Need

### Required Variables

| Variable | Description | Example | Where to Get |
|----------|-------------|---------|--------------|
| `gemini_api_key` | Google Gemini API Key | `AIza...` | https://aistudio.google.com/ |
| `s3_images_bucket_name` | S3 bucket for images (globally unique) | `chatbot-images-john-123` | Choose unique name |
| `s3_frontend_bucket_name` | S3 bucket for frontend (globally unique) | `chatbot-frontend-john-123` | Choose unique name |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `project_name` | Project name prefix | `chatbot-v2` | Change to avoid conflicts |
| `environment` | Environment name | `dev` | `dev`, `staging`, or `prod` |
| `aws_region` | AWS region | `us-east-1` | Any valid AWS region |
| `dynamodb_table_name` | DynamoDB table name | `ChatMessages-v2` | Change if conflicts |
| `openweather_api_key` | Weather API key | `""` | Optional - for weather feature |

## 🔧 Customizing Names to Avoid Conflicts

If you have previous failed deployments, **change these variables** in `terraform.tfvars`:

```hcl
# Change project name (affects Lambda function names)
project_name = "my-chatbot"  # Instead of "chatbot-v2"

# Change DynamoDB table name
dynamodb_table_name = "ChatMessages-MyApp"  # Instead of "ChatMessages-v2"

# Change S3 bucket names (must be globally unique!)
s3_images_bucket_name   = "my-unique-chatbot-images-2024"
s3_frontend_bucket_name = "my-unique-chatbot-web-2024"
```

**Generated Resource Names:**
- Lambda Functions: `{project_name}-{environment}-{function}`
  - Example: `my-chatbot-dev-chat-handler`
- DynamoDB: `{dynamodb_table_name}`
  - Example: `ChatMessages-MyApp`
- S3: `{s3_bucket_name}` (exactly as you specify)

## 📂 Project Structure

```
terraform/
├── main.tf                    # Main infrastructure
├── variables.tf               # Variable definitions
├── outputs.tf                 # Output values
├── terraform.tfvars.example   # Example variables
├── terraform.tfvars           # Your actual values (gitignored)
├── deploy.sh                  # Automated deployment script
├── deploy-frontend.sh         # Frontend deployment script
└── README.md                  # This file
```

## 🎛️ Deployment Scripts

### `deploy.sh` - Deploy Infrastructure

Automated script that:
1. ✅ Checks prerequisites (Terraform, AWS CLI)
2. ✅ Installs Lambda dependencies
3. ✅ Initializes Terraform
4. ✅ Validates configuration
5. ✅ Shows deployment plan
6. ✅ Deploys infrastructure
7. ✅ Displays summary with API URL

**Usage:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### `deploy-frontend.sh` - Deploy Frontend

Automated script that:
1. ✅ Gets S3 bucket name from Terraform
2. ✅ Gets API Gateway URL
3. ✅ Updates frontend config.js automatically
4. ✅ Uploads frontend to S3
5. ✅ Opens website in browser

**Usage:**
```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

## 📊 After Deployment

### View Outputs

```bash
# View all outputs
terraform output

# View specific output
terraform output api_gateway_url
terraform output frontend_website_url
```

### Test API Endpoints

```bash
# Get API URL
API_URL=$(terraform output -raw api_gateway_url)

# Test chat endpoint
curl -X POST $API_URL/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","sessionId":"test-123"}'

# Test image generation
curl -X POST $API_URL/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a robot","sessionId":"test-123"}'
```

### View Logs

```bash
# Get function name
FUNCTION=$(terraform output -json lambda_functions | jq -r '.chat_handler')

# View logs
aws logs tail /aws/lambda/$FUNCTION --follow
```

## 🔄 Updating Deployment

### Update Lambda Code

```bash
# After changing Lambda code
cd backend/functions/chat  # or any function
npm install  # if dependencies changed
cd ../../../terraform
terraform apply  # Redeploy
```

### Update Frontend

```bash
# After changing frontend code
./deploy-frontend.sh
```

### Update Infrastructure

```bash
# After changing Terraform files
terraform plan
terraform apply
```

## 🗑️ Cleanup / Destroy

### Destroy Everything

```bash
terraform destroy
```

**⚠️ Warning:** This will delete:
- All Lambda functions
- DynamoDB table (all chat data!)
- S3 buckets (all images and frontend files!)
- API Gateway
- IAM roles

### Destroy Specific Resources

```bash
# Delete only Lambda functions
terraform destroy -target=aws_lambda_function.chat_handler

# Delete only frontend bucket
terraform destroy -target=aws_s3_bucket.frontend
```

## 🐛 Troubleshooting

### Error: "bucket already exists"

**Problem:** S3 bucket name is not globally unique

**Solution:** Change `s3_images_bucket_name` and `s3_frontend_bucket_name` in `terraform.tfvars`

```hcl
s3_images_bucket_name   = "my-unique-name-12345"
s3_frontend_bucket_name = "my-unique-name-web-67890"
```

### Error: "table already exists"

**Problem:** DynamoDB table name conflicts with existing table

**Solution:** Change `dynamodb_table_name` in `terraform.tfvars`

```hcl
dynamodb_table_name = "ChatMessages-NewApp"
```

### Error: "function already exists"

**Problem:** Lambda function name conflicts

**Solution:** Change `project_name` in `terraform.tfvars`

```hcl
project_name = "my-new-chatbot"
```

### Error: "Invalid API key"

**Problem:** Gemini API key is incorrect or placeholder

**Solution:**
1. Get valid API key from https://aistudio.google.com/
2. Update `gemini_api_key` in `terraform.tfvars`
3. Run `terraform apply` again

### Error: "CORS policy blocked"

**Problem:** CORS not configured or frontend using wrong API URL

**Solution:**
1. Check `frontend/js/config.js` has correct `API_BASE_URL`
2. Run `./deploy-frontend.sh` to update automatically

### Terraform State Locked

**Problem:** Previous terraform command didn't finish

**Solution:**
```bash
# Force unlock (use with caution!)
terraform force-unlock LOCK_ID
```

## 📈 Monitoring

### View Lambda Metrics

```bash
# CloudWatch Logs
aws logs tail /aws/lambda/chatbot-v2-dev-chat-handler --follow

# Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=chatbot-v2-dev-chat-handler \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Check DynamoDB

```bash
# Scan table
aws dynamodb scan --table-name ChatMessages-v2

# Get item count
aws dynamodb describe-table --table-name ChatMessages-v2 \
  --query 'Table.ItemCount'
```

### Check S3 Usage

```bash
# List images
aws s3 ls s3://chatbot-images-v2-12345/images/

# Get bucket size
aws s3 ls s3://chatbot-images-v2-12345 --recursive --summarize
```

## 💰 Cost Estimation

**Within Free Tier:**
- Lambda: $0 (1M requests/month free)
- API Gateway: $0 (1M requests/month free)
- DynamoDB: $0 (25 GB free)
- S3: $0-$1 (5 GB free)
- **Total: ~$0/month** ✅

## 🔐 Security Best Practices

1. ✅ Never commit `terraform.tfvars` (contains API keys)
2. ✅ API keys stored encrypted in SSM Parameter Store
3. ✅ S3 images bucket is private (signed URLs only)
4. ✅ IAM roles follow least-privilege principle
5. ✅ DynamoDB encryption at rest enabled
6. ✅ HTTPS enforced for API Gateway

## 📚 Additional Resources

- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [Google Gemini API Docs](https://ai.google.dev/docs)

## 🆘 Need Help?

1. Check `terraform.tfvars.example` for required variables
2. Run `terraform plan` to see what will be created
3. Check AWS Console for resource conflicts
4. Review CloudWatch logs for runtime errors

## 📝 License

MIT
