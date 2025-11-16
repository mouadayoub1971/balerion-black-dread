terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_caller_identity" "current" {}

# =============================================================================
# DynamoDB Table
# =============================================================================

resource "aws_dynamodb_table" "chat_messages" {
  name           = var.dynamodb_table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "sessionId"
  range_key      = "timestamp"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = {
    Name        = var.dynamodb_table_name
    Environment = var.environment
    Project     = var.project_name
  }
}

# =============================================================================
# S3 Buckets
# =============================================================================

# Images Bucket
resource "aws_s3_bucket" "images" {
  bucket = var.s3_images_bucket_name

  tags = {
    Name        = var.s3_images_bucket_name
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_versioning" "images" {
  bucket = aws_s3_bucket.images.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    id     = "delete-old-images"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Frontend Bucket
resource "aws_s3_bucket" "frontend" {
  bucket = var.s3_frontend_bucket_name

  tags = {
    Name        = var.s3_frontend_bucket_name
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

# =============================================================================
# SSM Parameters (for API keys)
# =============================================================================

resource "aws_ssm_parameter" "gemini_api_key" {
  name        = var.gemini_api_key_param_name
  description = "Google Gemini API Key for chatbot"
  type        = "SecureString"
  value       = var.gemini_api_key

  tags = {
    Name        = "gemini-api-key"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_ssm_parameter" "openweather_api_key" {
  count       = var.openweather_api_key != "" ? 1 : 0
  name        = "/chatbot/openweather-api-key"
  description = "OpenWeatherMap API Key for weather function"
  type        = "SecureString"
  value       = var.openweather_api_key

  tags = {
    Name        = "openweather-api-key"
    Environment = var.environment
    Project     = var.project_name
  }
}

# =============================================================================
# IAM Role for Lambda
# =============================================================================

resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-role"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-${var.environment}-lambda-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.chat_messages.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.images.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          aws_ssm_parameter.gemini_api_key.arn,
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/chatbot/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-${var.environment}-*"
      }
    ]
  })
}

# =============================================================================
# Lambda Functions - Packaging
# =============================================================================

# Chat Handler
data "archive_file" "chat_handler" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/chat"
  output_path = "${path.module}/lambda_packages/chat_handler.zip"
}

# Image Generator
data "archive_file" "image_generator" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/generateImage"
  output_path = "${path.module}/lambda_packages/image_generator.zip"
}

# Get History
data "archive_file" "get_history" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/getHistory"
  output_path = "${path.module}/lambda_packages/get_history.zip"
}

# Video Generator
data "archive_file" "video_generator" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/generateVideo"
  output_path = "${path.module}/lambda_packages/video_generator.zip"
}

# Function Call Handler
data "archive_file" "function_call" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/functionCall"
  output_path = "${path.module}/lambda_packages/function_call.zip"
}

# Process Document
data "archive_file" "process_document" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/processDocument"
  output_path = "${path.module}/lambda_packages/process_document.zip"
}

# Web Search
data "archive_file" "web_search" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/webSearch"
  output_path = "${path.module}/lambda_packages/web_search.zip"
}

# Maps Search
data "archive_file" "maps_search" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/mapsSearch"
  output_path = "${path.module}/lambda_packages/maps_search.zip"
}

# Process Audio
data "archive_file" "process_audio" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/processAudio"
  output_path = "${path.module}/lambda_packages/process_audio.zip"
}

# =============================================================================
# Lambda Functions
# =============================================================================

# Chat Handler Function
resource "aws_lambda_function" "chat_handler" {
  filename         = data.archive_file.chat_handler.output_path
  function_name    = "${var.project_name}-${var.environment}-chat-handler"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.chat_handler.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      DYNAMODB_TABLE         = aws_dynamodb_table.chat_messages.name
      GEMINI_API_KEY_PARAM   = var.gemini_api_key_param_name
    }
  }

  tags = {
    Name        = "${var.project_name}-chat-handler"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Image Generator Function
resource "aws_lambda_function" "image_generator" {
  filename         = data.archive_file.image_generator.output_path
  function_name    = "${var.project_name}-${var.environment}-image-generator"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.image_generator.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 60
  memory_size     = 512

  environment {
    variables = {
      DYNAMODB_TABLE         = aws_dynamodb_table.chat_messages.name
      S3_BUCKET             = aws_s3_bucket.images.id
      GEMINI_API_KEY_PARAM   = var.gemini_api_key_param_name
    }
  }

  tags = {
    Name        = "${var.project_name}-image-generator"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Video Generator Function
resource "aws_lambda_function" "video_generator" {
  filename         = data.archive_file.video_generator.output_path
  function_name    = "${var.project_name}-${var.environment}-video-generator"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.video_generator.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 900  # 15 minutes for video generation
  memory_size     = 1024 # 1GB for video processing

  environment {
    variables = {
      DYNAMODB_TABLE       = aws_dynamodb_table.chat_messages.name
      S3_BUCKET            = aws_s3_bucket.images.id
      GEMINI_API_KEY_PARAM = var.gemini_api_key_param_name
    }
  }

  tags = {
    Name        = "${var.project_name}-video-generator"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Get History Function
resource "aws_lambda_function" "get_history" {
  filename         = data.archive_file.get_history.output_path
  function_name    = "${var.project_name}-${var.environment}-get-history"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.get_history.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 10
  memory_size     = 128

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.chat_messages.name
    }
  }

  tags = {
    Name        = "${var.project_name}-get-history"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Function Call Handler
resource "aws_lambda_function" "function_call" {
  filename         = data.archive_file.function_call.output_path
  function_name    = "${var.project_name}-${var.environment}-function-call"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.function_call.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      DYNAMODB_TABLE         = aws_dynamodb_table.chat_messages.name
      GEMINI_API_KEY_PARAM   = var.gemini_api_key_param_name
      OPENWEATHER_API_KEY    = var.openweather_api_key
    }
  }

  tags = {
    Name        = "${var.project_name}-function-call"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Process Document Function
resource "aws_lambda_function" "process_document" {
  filename         = data.archive_file.process_document.output_path
  function_name    = "${var.project_name}-${var.environment}-process-document"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.process_document.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 120  # 120 seconds for complex document processing
  memory_size     = 1024  # More memory = more CPU power

  environment {
    variables = {
      DYNAMODB_TABLE       = aws_dynamodb_table.chat_messages.name
      GEMINI_API_KEY_PARAM = var.gemini_api_key_param_name
      S3_BUCKET            = aws_s3_bucket.images.id
    }
  }

  tags = {
    Name        = "${var.project_name}-process-document"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Web Search Function
resource "aws_lambda_function" "web_search" {
  filename         = data.archive_file.web_search.output_path
  function_name    = "${var.project_name}-${var.environment}-web-search"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.web_search.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      DYNAMODB_TABLE       = aws_dynamodb_table.chat_messages.name
      GEMINI_API_KEY_PARAM = var.gemini_api_key_param_name
    }
  }

  tags = {
    Name        = "${var.project_name}-web-search"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Maps Search Function
resource "aws_lambda_function" "maps_search" {
  filename         = data.archive_file.maps_search.output_path
  function_name    = "${var.project_name}-${var.environment}-maps-search"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.maps_search.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      DYNAMODB_TABLE       = aws_dynamodb_table.chat_messages.name
      GEMINI_API_KEY_PARAM = var.gemini_api_key_param_name
    }
  }

  tags = {
    Name        = "${var.project_name}-maps-search"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Process Audio Function
resource "aws_lambda_function" "process_audio" {
  filename         = data.archive_file.process_audio.output_path
  function_name    = "${var.project_name}-${var.environment}-process-audio"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.handler"
  source_code_hash = data.archive_file.process_audio.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 120  # 120 seconds for audio processing
  memory_size     = 1024  # More memory for audio processing

  environment {
    variables = {
      DYNAMODB_TABLE       = aws_dynamodb_table.chat_messages.name
      GEMINI_API_KEY_PARAM = var.gemini_api_key_param_name
      S3_BUCKET            = aws_s3_bucket.images.id
    }
  }

  tags = {
    Name        = "${var.project_name}-process-audio"
    Environment = var.environment
    Project     = var.project_name
  }
}

# =============================================================================
# API Gateway HTTP API
# =============================================================================

resource "aws_apigatewayv2_api" "chatbot" {
  name          = "${var.project_name}-${var.environment}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 300
    allow_credentials = false
  }

  tags = {
    Name        = "${var.project_name}-api"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_apigatewayv2_stage" "chatbot" {
  api_id      = aws_apigatewayv2_api.chatbot.id
  name        = var.environment
  auto_deploy = true

  tags = {
    Name        = "${var.project_name}-api-stage"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "chat_handler" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

resource "aws_lambda_permission" "image_generator" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.image_generator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

resource "aws_lambda_permission" "video_generator" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_generator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_history" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_history.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

resource "aws_lambda_permission" "function_call" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function_call.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

resource "aws_lambda_permission" "process_document" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.process_document.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

resource "aws_lambda_permission" "web_search" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.web_search.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

resource "aws_lambda_permission" "maps_search" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.maps_search.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

resource "aws_lambda_permission" "process_audio" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.process_audio.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot.execution_arn}/*/*"
}

# API Gateway Integrations
resource "aws_apigatewayv2_integration" "chat_handler" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.chat_handler.invoke_arn
}

resource "aws_apigatewayv2_integration" "image_generator" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.image_generator.invoke_arn
}

resource "aws_apigatewayv2_integration" "video_generator" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.video_generator.invoke_arn
}

resource "aws_apigatewayv2_integration" "get_history" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.get_history.invoke_arn
}

resource "aws_apigatewayv2_integration" "function_call" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.function_call.invoke_arn
}

resource "aws_apigatewayv2_integration" "process_document" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.process_document.invoke_arn
}

resource "aws_apigatewayv2_integration" "web_search" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.web_search.invoke_arn
}

resource "aws_apigatewayv2_integration" "maps_search" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.maps_search.invoke_arn
}

resource "aws_apigatewayv2_integration" "process_audio" {
  api_id           = aws_apigatewayv2_api.chatbot.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.process_audio.invoke_arn
}

# API Gateway Routes
resource "aws_apigatewayv2_route" "chat" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "POST /chat"
  target    = "integrations/${aws_apigatewayv2_integration.chat_handler.id}"
}

resource "aws_apigatewayv2_route" "generate_image" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "POST /generate-image"
  target    = "integrations/${aws_apigatewayv2_integration.image_generator.id}"
}

resource "aws_apigatewayv2_route" "generate_video" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "POST /generate-video"
  target    = "integrations/${aws_apigatewayv2_integration.video_generator.id}"
}

resource "aws_apigatewayv2_route" "get_history" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "GET /history/{sessionId}"
  target    = "integrations/${aws_apigatewayv2_integration.get_history.id}"
}

resource "aws_apigatewayv2_route" "function_call" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "POST /function-call"
  target    = "integrations/${aws_apigatewayv2_integration.function_call.id}"
}

resource "aws_apigatewayv2_route" "process_document" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "POST /process-document"
  target    = "integrations/${aws_apigatewayv2_integration.process_document.id}"
}

resource "aws_apigatewayv2_route" "web_search" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "POST /web-search"
  target    = "integrations/${aws_apigatewayv2_integration.web_search.id}"
}

resource "aws_apigatewayv2_route" "maps_search" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "POST /maps-search"
  target    = "integrations/${aws_apigatewayv2_integration.maps_search.id}"
}

resource "aws_apigatewayv2_route" "process_audio" {
  api_id    = aws_apigatewayv2_api.chatbot.id
  route_key = "POST /process-audio"
  target    = "integrations/${aws_apigatewayv2_integration.process_audio.id}"
}
