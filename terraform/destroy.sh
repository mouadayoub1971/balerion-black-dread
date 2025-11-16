#!/bin/bash

set -e

echo "🗑️  Starting infrastructure destruction..."

# Function to completely empty an S3 bucket (including versioned objects)
empty_bucket() {
    local bucket=$1
    echo "📦 Emptying bucket: $bucket"

    # Delete all objects
    aws s3 rm "s3://$bucket" --recursive 2>/dev/null || true

    # Delete all versions
    echo "   Deleting all object versions..."
    aws s3api delete-objects --bucket "$bucket" \
        --delete "$(aws s3api list-object-versions --bucket "$bucket" \
        --output json --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}')" \
        2>/dev/null || true

    # Delete all delete markers
    echo "   Deleting all delete markers..."
    aws s3api delete-objects --bucket "$bucket" \
        --delete "$(aws s3api list-object-versions --bucket "$bucket" \
        --output json --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}')" \
        2>/dev/null || true

    echo "   ✓ Bucket $bucket is now empty"
}

# Get bucket names from Terraform outputs
IMAGES_BUCKET=$(terraform output -raw s3_images_bucket_name 2>/dev/null || echo "")
FRONTEND_BUCKET=$(terraform output -raw s3_frontend_bucket_name 2>/dev/null || echo "")

# Empty S3 buckets if they exist
if [ -n "$IMAGES_BUCKET" ]; then
    empty_bucket "$IMAGES_BUCKET"
fi

if [ -n "$FRONTEND_BUCKET" ]; then
    empty_bucket "$FRONTEND_BUCKET"
fi

# Run Terraform destroy
echo "🔥 Running terraform destroy..."
terraform destroy -auto-approve

echo "✅ Infrastructure destroyed successfully!"
echo ""
echo "💰 Cost after destruction: $0/month"
echo "📝 Your terraform.tfvars is preserved for future deployments"
