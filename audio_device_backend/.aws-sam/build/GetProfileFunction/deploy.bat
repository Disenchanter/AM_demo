@echo off
setlocal enabledelayedexpansion

REM 音频设备管理系统 - AWS SAM 部署脚本 (Windows版本)

REM 默认参数
set ENVIRONMENT=dev
set REGION=us-east-1
set STACK_NAME=audio-device-backend
set COGNITO_USER_POOL_NAME=AudioDeviceUsers

REM 解析命令行参数
:parse_args
if "%1"=="" goto check_params
if "%1"=="-e" (
    set ENVIRONMENT=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--environment" (
    set ENVIRONMENT=%2
    shift
    shift
    goto parse_args
)
if "%1"=="-r" (
    set REGION=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--region" (
    set REGION=%2
    shift
    shift
    goto parse_args
)
if "%1"=="-s" (
    set STACK_NAME=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--stack-name" (
    set STACK_NAME=%2
    shift
    shift
    goto parse_args
)
if "%1"=="-u" (
    set COGNITO_USER_POOL_NAME=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--user-pool-name" (
    set COGNITO_USER_POOL_NAME=%2
    shift
    shift
    goto parse_args
)
if "%1"=="-h" goto show_help
if "%1"=="--help" goto show_help

echo 错误: 未知参数 %1
goto show_help

:show_help
echo.
echo Usage: %0 [OPTIONS]
echo.
echo Options:
echo   -e, --environment ENVIRONMENT  部署环境 (dev/staging/prod) [默认: %ENVIRONMENT%]
echo   -r, --region REGION            AWS区域 [默认: %REGION%]
echo   -s, --stack-name STACK_NAME    CloudFormation堆栈名称 [默认: %STACK_NAME%]
echo   -u, --user-pool-name NAME      Cognito用户池名称 [默认: %COGNITO_USER_POOL_NAME%]
echo   -h, --help                     显示帮助信息
echo.
echo Examples:
echo   %0                                     REM 部署到dev环境
echo   %0 -e staging -r us-west-2            REM 部署到staging环境，美西区域
echo   %0 -e prod -s audio-device-prod       REM 部署到prod环境，自定义堆栈名
echo.
exit /b 0

:check_params
REM 验证环境参数
if not "%ENVIRONMENT%"=="dev" if not "%ENVIRONMENT%"=="staging" if not "%ENVIRONMENT%"=="prod" (
    echo 错误: 环境参数必须是 dev, staging 或 prod
    exit /b 1
)

REM 构建完整堆栈名称
set FULL_STACK_NAME=%STACK_NAME%-%ENVIRONMENT%

echo ========================================
echo   音频设备管理系统 - AWS 部署
echo ========================================
echo 环境: %ENVIRONMENT%
echo 区域: %REGION%
echo 堆栈名称: %FULL_STACK_NAME%
echo 用户池名称: %COGNITO_USER_POOL_NAME%
echo.

REM 检查必要工具
echo 检查必要工具...
where sam >nul 2>nul
if errorlevel 1 (
    echo 错误: AWS SAM CLI 未安装
    echo 请安装 SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
    exit /b 1
)

where aws >nul 2>nul
if errorlevel 1 (
    echo 错误: AWS CLI 未安装
    echo 请安装 AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
    exit /b 1
)

echo ✓ 工具检查通过

REM 检查 AWS 凭证
echo 检查 AWS 凭证...
aws sts get-caller-identity >nul 2>nul
if errorlevel 1 (
    echo 错误: AWS 凭证未配置或已过期
    echo 请运行 'aws configure' 配置凭证
    exit /b 1
)

for /f "tokens=*" %%a in ('aws sts get-caller-identity --query Account --output text') do set AWS_ACCOUNT_ID=%%a
echo ✓ AWS 凭证有效 (账户: %AWS_ACCOUNT_ID%)

REM 创建 S3 存储桶用于部署包（如果不存在）
set BUCKET_NAME=sam-deployments-%AWS_ACCOUNT_ID%-%REGION%
echo 检查部署存储桶...

aws s3 ls "s3://%BUCKET_NAME%" >nul 2>nul
if errorlevel 1 (
    echo 创建部署存储桶: %BUCKET_NAME%
    if "%REGION%"=="us-east-1" (
        aws s3 mb "s3://%BUCKET_NAME%" --region "%REGION%"
    ) else (
        aws s3 mb "s3://%BUCKET_NAME%" --region "%REGION%" --create-bucket-configuration LocationConstraint="%REGION%"
    )
) else (
    echo ✓ 部署存储桶已存在
)

REM SAM 构建
echo 构建 SAM 应用...
sam build --region "%REGION%"
if errorlevel 1 (
    echo 错误: SAM 构建失败
    exit /b 1
)

echo ✓ 构建成功

REM 部署确认
echo.
echo 准备部署到以下环境:
echo   环境: %ENVIRONMENT%
echo   区域: %REGION%
echo   堆栈: %FULL_STACK_NAME%
echo.

set /p CONFIRM=确认部署? (y/N): 
if /i not "%CONFIRM%"=="y" (
    echo 部署已取消
    exit /b 0
)

REM SAM 部署
echo 部署 SAM 应用...
sam deploy ^
    --stack-name "%FULL_STACK_NAME%" ^
    --s3-bucket "%BUCKET_NAME%" ^
    --capabilities CAPABILITY_IAM ^
    --region "%REGION%" ^
    --parameter-overrides Environment="%ENVIRONMENT%" CognitoUserPoolName="%COGNITO_USER_POOL_NAME%" ^
    --no-confirm-changeset ^
    --no-fail-on-empty-changeset

if errorlevel 1 (
    echo 错误: 部署失败
    exit /b 1
)

echo ✓ 部署成功

REM 获取输出信息
echo 获取部署信息...
for /f "tokens=*" %%a in ('aws cloudformation describe-stacks --stack-name "%FULL_STACK_NAME%" --region "%REGION%" --query "Stacks[0].Outputs[?OutputKey=='AudioDeviceApiUrl'].OutputValue" --output text') do set API_URL=%%a

for /f "tokens=*" %%a in ('aws cloudformation describe-stacks --stack-name "%FULL_STACK_NAME%" --region "%REGION%" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text') do set USER_POOL_ID=%%a

for /f "tokens=*" %%a in ('aws cloudformation describe-stacks --stack-name "%FULL_STACK_NAME%" --region "%REGION%" --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text') do set USER_POOL_CLIENT_ID=%%a

REM 显示部署结果
echo.
echo ========================================
echo   部署完成！
echo ========================================
echo.
echo API 端点:
echo   %API_URL%
echo.
echo Cognito 信息:
echo   用户池 ID: %USER_POOL_ID%
echo   客户端 ID: %USER_POOL_CLIENT_ID%
echo   区域: %REGION%
echo.
echo 下一步操作:
echo   1. 在 Cognito 控制台创建用户账户
echo   2. 将用户添加到相应的用户组 (admin/user)
echo   3. 更新 Flutter 应用的 AWS 配置
echo   4. 测试 API 端点
echo.

REM 保存配置信息到文件
set CONFIG_FILE=deployment-config-%ENVIRONMENT%.json
echo { > "%CONFIG_FILE%"
echo   "environment": "%ENVIRONMENT%", >> "%CONFIG_FILE%"
echo   "region": "%REGION%", >> "%CONFIG_FILE%"
echo   "stackName": "%FULL_STACK_NAME%", >> "%CONFIG_FILE%"
echo   "apiUrl": "%API_URL%", >> "%CONFIG_FILE%"
echo   "cognito": { >> "%CONFIG_FILE%"
echo     "userPoolId": "%USER_POOL_ID%", >> "%CONFIG_FILE%"
echo     "userPoolClientId": "%USER_POOL_CLIENT_ID%", >> "%CONFIG_FILE%"
echo     "region": "%REGION%" >> "%CONFIG_FILE%"
echo   } >> "%CONFIG_FILE%"
echo } >> "%CONFIG_FILE%"

echo 配置信息已保存到: %CONFIG_FILE%
echo.
echo 部署脚本执行完成！

endlocal