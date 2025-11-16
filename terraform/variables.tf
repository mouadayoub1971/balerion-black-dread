# =============================================================================
# Terraform Variables for Serverless Chatbot
# =============================================================================

# -----------------------------------------------------------------------------
# Project Configuration
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Project name used for resource naming (use unique name to avoid conflicts)"
  type        = string
  default     = "chatbot-v2"

  validation {
    condition     = length(var.project_name) > 0 && length(var.project_name) <= 20
    error_message = "Project name must be between 1 and 20 characters."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# -----------------------------------------------------------------------------
# AWS Configuration
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# API Keys (REQUIRED)
# -----------------------------------------------------------------------------

variable "gemini_api_key" {
  description = "Google Gemini API Key (REQUIRED - get from https://aistudio.google.com/)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.gemini_api_key) > 0
    error_message = "Gemini API key is required. Get it from https://aistudio.google.com/"
  }
}

variable "gemini_api_key_param_name" {
  description = "SSM Parameter Store path for Gemini API key"
  type        = string
  default     = "/chatbot/gemini-api-key"
}

variable "openweather_api_key" {
  description = "OpenWeatherMap API Key (Optional - for weather function)"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Resource Names (Customizable to avoid conflicts)
# -----------------------------------------------------------------------------

variable "dynamodb_table_name" {
  description = "DynamoDB table name for chat messages (must be unique)"
  type        = string
  default     = "ChatMessages-v2"

  validation {
    condition     = length(var.dynamodb_table_name) >= 3 && length(var.dynamodb_table_name) <= 255
    error_message = "DynamoDB table name must be between 3 and 255 characters."
  }
}

variable "s3_images_bucket_name" {
  description = "S3 bucket name for generated images (must be globally unique)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.s3_images_bucket_name))
    error_message = "S3 bucket name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "s3_frontend_bucket_name" {
  description = "S3 bucket name for frontend static files (must be globally unique)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.s3_frontend_bucket_name))
    error_message = "S3 bucket name must contain only lowercase letters, numbers, and hyphens."
  }
}

# -----------------------------------------------------------------------------
# Lambda Configuration
# -----------------------------------------------------------------------------

variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "nodejs18.x"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30

  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 256

  validation {
    condition     = var.lambda_memory_size >= 128 && var.lambda_memory_size <= 10240
    error_message = "Lambda memory size must be between 128 and 10240 MB."
  }
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
