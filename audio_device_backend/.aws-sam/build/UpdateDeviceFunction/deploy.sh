#!/bin/bash

# 音频设备管理系统 - AWS SAM 部署脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认参数
ENVIRONMENT="dev"
REGION="us-east-1"
STACK_NAME="audio-device-backend"
COGNITO_USER_POOL_NAME="AudioDeviceUsers"

# 帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENVIRONMENT  部署环境 (dev/staging/prod) [默认: $ENVIRONMENT]"
    echo "  -r, --region REGION            AWS区域 [默认: $REGION]"
    echo "  -s, --stack-name STACK_NAME    CloudFormation堆栈名称 [默认: $STACK_NAME]"
    echo "  -u, --user-pool-name NAME      Cognito用户池名称 [默认: $COGNITO_USER_POOL_NAME]"
    echo "  -h, --help                     显示帮助信息"
    echo ""
    echo "Examples:"
    echo "  $0                                     # 部署到dev环境"
    echo "  $0 -e staging -r us-west-2            # 部署到staging环境，美西区域"
    echo "  $0 -e prod -s audio-device-prod       # 部署到prod环境，自定义堆栈名"
}

# 解析命令行参数
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
            echo -e "${RED}错误: 未知参数 $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 验证环境参数
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}错误: 环境参数必须是 dev, staging 或 prod${NC}"
    exit 1
fi

# 构建完整堆栈名称
FULL_STACK_NAME="${STACK_NAME}-${ENVIRONMENT}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  音频设备管理系统 - AWS 部署${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}环境:${NC} $ENVIRONMENT"
echo -e "${YELLOW}区域:${NC} $REGION"
echo -e "${YELLOW}堆栈名称:${NC} $FULL_STACK_NAME"
echo -e "${YELLOW}用户池名称:${NC} $COGNITO_USER_POOL_NAME"
echo ""

# 检查必要工具
echo -e "${BLUE}检查必要工具...${NC}"
if ! command -v sam &> /dev/null; then
    echo -e "${RED}错误: AWS SAM CLI 未安装${NC}"
    echo "请安装 SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}错误: AWS CLI 未安装${NC}"
    echo "请安装 AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

echo -e "${GREEN}✓ 工具检查通过${NC}"

# 检查 AWS 凭证
echo -e "${BLUE}检查 AWS 凭证...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}错误: AWS 凭证未配置或已过期${NC}"
    echo "请运行 'aws configure' 配置凭证"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS 凭证有效 (账户: $AWS_ACCOUNT_ID)${NC}"

# 创建 S3 存储桶用于部署包（如果不存在）
BUCKET_NAME="sam-deployments-${AWS_ACCOUNT_ID}-${REGION}"
echo -e "${BLUE}检查部署存储桶...${NC}"

if ! aws s3 ls "s3://$BUCKET_NAME" &> /dev/null; then
    echo -e "${YELLOW}创建部署存储桶: $BUCKET_NAME${NC}"
    if [[ "$REGION" == "us-east-1" ]]; then
        aws s3 mb "s3://$BUCKET_NAME" --region "$REGION"
    else
        aws s3 mb "s3://$BUCKET_NAME" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION"
    fi
else
    echo -e "${GREEN}✓ 部署存储桶已存在${NC}"
fi

# SAM 构建
echo -e "${BLUE}构建 SAM 应用...${NC}"
sam build --region "$REGION"

if [ $? -ne 0 ]; then
    echo -e "${RED}错误: SAM 构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 构建成功${NC}"

# 部署确认
echo ""
echo -e "${YELLOW}准备部署到以下环境:${NC}"
echo -e "  环境: $ENVIRONMENT"
echo -e "  区域: $REGION"
echo -e "  堆栈: $FULL_STACK_NAME"
echo ""

read -p "确认部署? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}部署已取消${NC}"
    exit 0
fi

# SAM 部署
echo -e "${BLUE}部署 SAM 应用...${NC}"
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
    echo -e "${RED}错误: 部署失败${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 部署成功${NC}"

# 获取输出信息
echo -e "${BLUE}获取部署信息...${NC}"
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

# 显示部署结果
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}API 端点:${NC}"
echo -e "  $API_URL"
echo ""
echo -e "${YELLOW}Cognito 信息:${NC}"
echo -e "  用户池 ID: $USER_POOL_ID"
echo -e "  客户端 ID: $USER_POOL_CLIENT_ID"
echo -e "  区域: $REGION"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo -e "  1. 在 Cognito 控制台创建用户账户"
echo -e "  2. 将用户添加到相应的用户组 (admin/user)"
echo -e "  3. 更新 Flutter 应用的 AWS 配置"
echo -e "  4. 测试 API 端点"
echo ""

# 保存配置信息到文件
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

echo -e "${BLUE}配置信息已保存到: $CONFIG_FILE${NC}"
echo ""
echo -e "${GREEN}部署脚本执行完成！${NC}"