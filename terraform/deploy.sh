#!/bin/bash

# =============================================================================
# Serverless Chatbot - Terraform Deployment Script
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Serverless Chatbot - Terraform Deployment             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Error: Terraform is not installed${NC}"
    echo "Please install Terraform from: https://www.terraform.io/downloads"
    exit 1
fi

echo -e "${GREEN}✅ Terraform is installed${NC}"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI is not configured${NC}"
    echo "Please run: aws configure"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI is configured${NC}"

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo -e "${RED}❌ Error: terraform.tfvars not found${NC}"
    echo "Please create terraform.tfvars from terraform.tfvars.example:"
    echo "  cp terraform.tfvars.example terraform.tfvars"
    echo "Then edit it with your actual values"
    exit 1
fi

echo -e "${GREEN}✅ terraform.tfvars found${NC}"

# Install Lambda dependencies
echo -e "\n${YELLOW}📦 Installing Lambda dependencies...${NC}"
cd ../backend/functions

for dir in chat generateImage generateVideo processDocument getHistory functionCall; do
    if [ -d "$dir" ]; then
        echo -e "${BLUE}  → Installing dependencies for $dir${NC}"
        cd "$dir"
        if [ -f "package.json" ]; then
            npm install --production 2>&1 | grep -v "npm WARN" || true
        fi
        cd ..
    fi
done

cd ../../terraform

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Initialize Terraform
echo -e "\n${YELLOW}🔧 Initializing Terraform...${NC}"
terraform init

# Validate Terraform configuration
echo -e "\n${YELLOW}✔️  Validating Terraform configuration...${NC}"
terraform validate

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Terraform validation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Terraform configuration is valid${NC}"

# Show Terraform plan
echo -e "\n${YELLOW}📋 Generating Terraform plan...${NC}"
terraform plan -out=tfplan

# Ask for confirmation
echo -e "\n${YELLOW}Do you want to apply this plan? (yes/no)${NC}"
read -p "> " confirmation

if [ "$confirmation" != "yes" ]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Apply Terraform
echo -e "\n${YELLOW}🚀 Deploying infrastructure...${NC}"
terraform apply tfplan

# Clean up plan file
rm -f tfplan

# Get outputs
echo -e "\n${GREEN}✅ Deployment completed!${NC}"
echo -e "\n${BLUE}📊 Deployment Summary:${NC}"
terraform output deployment_summary

# Save API URL to file for easy reference
API_URL=$(terraform output -raw api_gateway_url)
echo "$API_URL" > ../API_URL.txt
echo -e "\n${GREEN}💾 API URL saved to: API_URL.txt${NC}"

# Remind user to update frontend config
echo -e "\n${YELLOW}⚠️  IMPORTANT: Update frontend configuration${NC}"
echo -e "Edit ${BLUE}frontend/js/config.js${NC} and set:"
echo -e "  API_BASE_URL = '${GREEN}$API_URL${NC}'"

echo -e "\n${GREEN}✅ All done! Your chatbot backend is deployed!${NC}"
echo -e "${BLUE}Next step: Deploy frontend with ./deploy-frontend.sh${NC}\n"
