#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
sleep 5

# Create S3 bucket
echo "Creating S3 bucket: directus-uploads"
awslocal s3 mb s3://directus-uploads 2>/dev/null || echo "Bucket already exists"

# Set bucket CORS configuration for Directus
echo "Setting CORS configuration..."
awslocal s3api put-bucket-cors --bucket directus-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'

# Set public access policy (for development only)
echo "Setting bucket policy..."
awslocal s3api put-bucket-policy --bucket directus-uploads --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::directus-uploads/*"
    }
  ]
}'

echo "S3 bucket setup complete!"
echo "Bucket: directus-uploads"
echo "Region: us-east-1"
echo "Endpoint: http://localstack:4566"
