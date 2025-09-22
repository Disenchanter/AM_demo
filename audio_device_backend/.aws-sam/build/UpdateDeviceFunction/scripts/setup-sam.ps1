# SAM 部署配置
# 设置这些环境变量来控制 SAM 行为

# 禁用遥测
$env:SAM_CLI_TELEMETRY = "0"

# 禁用警告
$env:AWS_SAM_CLI_DISABLE_WARNINGS = "1"

# 跳过确认
$env:SAM_CLI_AUTO_CONFIRM = "1"

Write-Host "🔧 SAM 环境变量已设置，警告将被忽略"
Write-Host "📋 可用命令:"
Write-Host "  sam build"
Write-Host "  sam deploy --config-env dev"
Write-Host "  sam validate"

# 可选：直接运行命令
if ($args.Count -gt 0) {
    $command = $args -join " "
    Write-Host "🚀 执行: $command"
    Invoke-Expression $command
}