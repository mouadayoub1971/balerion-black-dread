#!/bin/bash

# =============================================================================
# Frontend Deployment Script
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Frontend Deployment to S3                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if frontend directory exists
if [ ! -d "../frontend" ]; then
    echo -e "${RED}❌ Error: frontend directory not found${NC}"
    exit 1
fi

# Get S3 bucket name from Terraform output
BUCKET_NAME=$(terraform output -raw s3_frontend_bucket 2>/dev/null)

if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}❌ Error: Could not get S3 bucket name from Terraform${NC}"
    echo "Make sure you have deployed infrastructure first with ./deploy.sh"
    exit 1
fi

echo -e "${GREEN}✅ S3 Bucket: $BUCKET_NAME${NC}"

# Get API URL
API_URL=$(terraform output -raw api_gateway_url 2>/dev/null)

if [ -z "$API_URL" ]; then
    echo -e "${RED}❌ Error: Could not get API Gateway URL${NC}"
    exit 1
fi

echo -e "${GREEN}✅ API URL: $API_URL${NC}"

# Check if config.js has been updated
if grep -q "YOUR_API_GATEWAY_URL_HERE" ../frontend/js/config.js; then
    echo -e "\n${YELLOW}⚠️  Warning: config.js still contains placeholder${NC}"
    echo -e "${YELLOW}Updating config.js with API URL...${NC}"

    # Backup original
    cp ../frontend/js/config.js ../frontend/js/config.js.backup

    # Replace placeholder with actual URL
    sed -i "s|https://YOUR_API_GATEWAY_URL_HERE|$API_URL|g" ../frontend/js/config.js

    echo -e "${GREEN}✅ config.js updated${NC}"
fi

# Upload frontend to S3
echo -e "\n${YELLOW}📤 Uploading frontend files to S3...${NC}"

aws s3 sync ../frontend/ s3://$BUCKET_NAME \
    --exclude ".git/*" \
    --exclude "*.md" \
    --exclude "*.example" \
    --delete \
    --cache-control "public, max-age=300"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"

    # Get website URL
    REGION=$(terraform output -raw api_gateway_url | cut -d'.' -f3)
    WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"

    echo -e "\n${GREEN}🎉 Your chatbot is live!${NC}"
    echo -e "${BLUE}URL: $WEBSITE_URL${NC}"

    # Save URL to file
    echo "$WEBSITE_URL" > ../WEBSITE_URL.txt
    echo -e "\n${GREEN}💾 Website URL saved to: WEBSITE_URL.txt${NC}"

    echo -e "\n${YELLOW}Opening in browser...${NC}"

    # Try to open in browser (cross-platform)
    if command -v xdg-open &> /dev/null; then
        xdg-open "$WEBSITE_URL"
    elif command -v open &> /dev/null; then
        open "$WEBSITE_URL"
    elif command -v start &> /dev/null; then
        start "$WEBSITE_URL"
    else
        echo -e "${BLUE}Please open this URL in your browser:${NC}"
        echo -e "${GREEN}$WEBSITE_URL${NC}"
    fi
else
    echo -e "${RED}❌ Frontend deployment failed${NC}"
    exit 1
fi
