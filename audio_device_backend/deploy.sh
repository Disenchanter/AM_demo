#!/bin/bash

# Audio Device Management System - AWS SAM deployment script

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default parameters
ENVIRONMENT="dev"
REGION="us-east-1"
STACK_NAME="audio-device-backend"
COGNITO_USER_POOL_NAME="AudioDeviceUsers"

# Help text
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENVIRONMENT  Deployment environment (dev/staging/prod) [default: $ENVIRONMENT]"
    echo "  -r, --region REGION            AWS region [default: $REGION]"
    echo "  -s, --stack-name STACK_NAME    CloudFormation stack name [default: $STACK_NAME]"
    echo "  -u, --user-pool-name NAME      Cognito user pool name [default: $COGNITO_USER_POOL_NAME]"
    echo "  -h, --help                     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                     # Deploy to the dev environment"
    echo "  $0 -e staging -r us-west-2            # Deploy to staging in us-west-2"
    echo "  $0 -e prod -s audio-device-prod       # Deploy to prod with a custom stack name"
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -u|--user-pool-name)
            COGNITO_USER_POOL_NAME="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown argument $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment argument
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}Error: Environment must be dev, staging, or prod${NC}"
    exit 1
fi

# Build the full stack name
FULL_STACK_NAME="${STACK_NAME}-${ENVIRONMENT}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Audio Device Management - AWS Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Environment:${NC} $ENVIRONMENT"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Stack name:${NC} $FULL_STACK_NAME"
echo -e "${YELLOW}User pool name:${NC} $COGNITO_USER_POOL_NAME"
echo ""

# Check required tooling
echo -e "${BLUE}Checking required tools...${NC}"
if ! command -v sam &> /dev/null; then
    echo -e "${RED}Error: AWS SAM CLI is not installed${NC}"
    echo "Install SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

echo -e "${GREEN}✓ Tooling check passed${NC}"

# Check AWS credentials
echo -e "${BLUE}Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials are missing or expired${NC}"
    echo "Run 'aws configure' to set up credentials"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS credentials valid (account: $AWS_ACCOUNT_ID)${NC}"

# Create S3 bucket for deployment artifacts (if needed)
BUCKET_NAME="sam-deployments-${AWS_ACCOUNT_ID}-${REGION}"
echo -e "${BLUE}Checking deployment bucket...${NC}"

if ! aws s3 ls "s3://$BUCKET_NAME" &> /dev/null; then
    echo -e "${YELLOW}Creating deployment bucket: $BUCKET_NAME${NC}"
    if [[ "$REGION" == "us-east-1" ]]; then
        aws s3 mb "s3://$BUCKET_NAME" --region "$REGION"
    else
        aws s3 mb "s3://$BUCKET_NAME" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION"
    fi
else
    echo -e "${GREEN}✓ Deployment bucket already exists${NC}"
fi

# SAM build
echo -e "${BLUE}Building SAM application...${NC}"
sam build --region "$REGION"

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: SAM build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build succeeded${NC}"

# Deployment confirmation
echo ""
echo -e "${YELLOW}Ready to deploy with the following configuration:${NC}"
echo -e "  Environment: $ENVIRONMENT"
echo -e "  Region: $REGION"
echo -e "  Stack: $FULL_STACK_NAME"
echo ""

read -p "Proceed with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# SAM deploy
echo -e "${BLUE}Deploying SAM application...${NC}"
sam deploy \
    --stack-name "$FULL_STACK_NAME" \
    --s3-bucket "$BUCKET_NAME" \
    --capabilities CAPABILITY_IAM \
    --region "$REGION" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        CognitoUserPoolName="$COGNITO_USER_POOL_NAME" \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Deployment succeeded${NC}"

# Fetch stack outputs
echo -e "${BLUE}Retrieving deployment outputs...${NC}"
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$FULL_STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='AudioDeviceApiUrl'].OutputValue" \
    --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$FULL_STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$FULL_STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
    --output text)

# Display deployment results
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}API endpoint:${NC}"
echo -e "  $API_URL"
echo ""
echo -e "${YELLOW}Cognito details:${NC}"
echo -e "  User Pool ID: $USER_POOL_ID"
echo -e "  Client ID: $USER_POOL_CLIENT_ID"
echo -e "  Region: $REGION"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Create user accounts in the Cognito console"
echo -e "  2. Assign users to the appropriate groups (admin/user)"
echo -e "  3. Update the Flutter app's AWS configuration"
echo -e "  4. Test the API endpoints"
echo ""

# Save configuration to file
CONFIG_FILE="deployment-config-${ENVIRONMENT}.json"
cat > "$CONFIG_FILE" << EOF
{
  "environment": "$ENVIRONMENT",
  "region": "$REGION",
  "stackName": "$FULL_STACK_NAME",
  "apiUrl": "$API_URL",
  "cognito": {
    "userPoolId": "$USER_POOL_ID",
    "userPoolClientId": "$USER_POOL_CLIENT_ID",
    "region": "$REGION"
  }
}
EOF

echo -e "${BLUE}Configuration saved to: $CONFIG_FILE${NC}"
echo ""
echo -e "${GREEN}Deployment script completed!${NC}"