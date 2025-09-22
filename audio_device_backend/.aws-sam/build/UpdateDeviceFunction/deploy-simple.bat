@echo off
REM 简化的部署脚本 - 单表架构

echo ==============================================
echo Audio Device Management - 单表架构部署
echo ==============================================
echo.

echo 验证SAM模板...
sam validate
if errorlevel 1 (
    echo 模板验证失败!
    pause
    exit /b 1
)

echo.
echo 构建应用...
sam build
if errorlevel 1 (
    echo 构建失败!
    pause
    exit /b 1
)

echo.
echo 部署应用...
echo 环境: dev
echo 表设计: AudioManagement单表
sam deploy --stack-name audio-device-backend-single --parameter-overrides Environment=dev --capabilities CAPABILITY_IAM --region us-east-1

if errorlevel 1 (
    echo 部署失败!
    pause
    exit /b 1
)

echo.
echo 部署成功! 
echo 单表架构已部署完成。
pause