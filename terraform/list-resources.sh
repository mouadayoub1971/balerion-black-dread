#!/bin/bash

echo "=========================================="
echo "AWS RESOURCES INVENTORY"
echo "=========================================="
echo ""

# Get AWS Account Info
echo "📋 AWS ACCOUNT INFO"
echo "-------------------"
aws sts get-caller-identity --query '{Account:Account,UserId:UserId,Arn:Arn}' --output table
echo ""

# Lambda Functions
echo "🔧 LAMBDA FUNCTIONS"
echo "-------------------"
LAMBDA_COUNT=$(aws lambda list-functions --query 'length(Functions)' --output text)
if [ "$LAMBDA_COUNT" -gt 0 ]; then
    aws lambda list-functions --query "Functions[].[FunctionName,Runtime,MemorySize,LastModified]" --output table
else
    echo "No Lambda functions found"
fi
echo ""

# API Gateways (HTTP/REST)
echo "🌐 API GATEWAYS (HTTP API)"
echo "--------------------------"
API_COUNT=$(aws apigatewayv2 get-apis --query 'length(Items)' --output text)
if [ "$API_COUNT" -gt 0 ]; then
    aws apigatewayv2 get-apis --query "Items[].[Name,ApiId,ProtocolType,ApiEndpoint]" --output table
else
    echo "No HTTP APIs found"
fi
echo ""

# DynamoDB Tables
echo "📊 DYNAMODB TABLES"
echo "------------------"
TABLE_COUNT=$(aws dynamodb list-tables --query 'length(TableNames)' --output text)
if [ "$TABLE_COUNT" -gt 0 ]; then
    aws dynamodb list-tables --output table
else
    echo "No DynamoDB tables found"
fi
echo ""

# S3 Buckets
echo "📦 S3 BUCKETS"
echo "-------------"
BUCKET_COUNT=$(aws s3 ls | wc -l)
if [ "$BUCKET_COUNT" -gt 0 ]; then
    aws s3 ls
else
    echo "No S3 buckets found"
fi
echo ""

# EC2 Instances
echo "🖥️  EC2 INSTANCES"
echo "----------------"
INSTANCE_COUNT=$(aws ec2 describe-instances --query 'length(Reservations[].Instances[])' --output text)
if [ "$INSTANCE_COUNT" -gt 0 ]; then
    aws ec2 describe-instances --query "Reservations[].Instances[].[InstanceId,InstanceType,State.Name,Tags[?Key=='Name'].Value|[0]]" --output table
else
    echo "No EC2 instances found"
fi
echo ""

# IAM Roles (filtered for Lambda/API Gateway)
echo "👤 IAM ROLES (Lambda/API Gateway)"
echo "---------------------------------"
aws iam list-roles --query "Roles[?contains(RoleName, 'lambda') || contains(RoleName, 'chatbot') || contains(RoleName, 'api')].RoleName" --output table
echo ""

# CloudWatch Log Groups (filtered)
echo "📝 CLOUDWATCH LOG GROUPS (Lambda)"
echo "---------------------------------"
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda" --query "logGroups[].[logGroupName,storedBytes]" --output table | head -20
echo ""

# SSM Parameters
echo "🔐 SSM PARAMETERS"
echo "-----------------"
PARAM_COUNT=$(aws ssm describe-parameters --query 'length(Parameters)' --output text)
if [ "$PARAM_COUNT" -gt 0 ]; then
    aws ssm describe-parameters --query "Parameters[].[Name,Type,LastModifiedDate]" --output table
else
    echo "No SSM parameters found"
fi
echo ""

# Cost Summary (Month to Date)
echo "💰 COST ESTIMATE (Month to Date)"
echo "--------------------------------"
START_DATE=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)
aws ce get-cost-and-usage \
    --time-period Start=$START_DATE,End=$END_DATE \
    --granularity MONTHLY \
    --metrics "UnblendedCost" \
    --query "ResultsByTime[0].Total.UnblendedCost.{Amount:Amount,Unit:Unit}" \
    --output table 2>/dev/null || echo "Cost Explorer not available (may need to enable)"
echo ""

echo "=========================================="
echo "✅ Resource inventory complete!"
echo "=========================================="
