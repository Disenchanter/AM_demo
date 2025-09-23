# Audio Device Manager - Backend

## 🎵 项目概述

音频设备管理系统的AWS Serverless后端，支持多用户音频设备管理和预设配置。

### 🏗️ 技术栈
- **API**: AWS API Gateway + Lambda (Node.js 20.x)
- **认证**: AWS Cognito (JWT)
- **数据库**: DynamoDB (Single Table Design)
- **部署**: AWS SAM CLI
- **权限**: 基于角色的访问控制 (RBAC)

### 📁 项目结构
```
audio_device_backend/
├── lambda/              # Lambda函数
│   ├── devices/        # 设备管理
│   ├── presets/        # 预设管理  
│   └── users/          # 用户管理
├── shared/             # 共享模型和工具
│   ├── models/         # 数据模型
│   └── utils/          # 工具函数
├── scripts/            # 管理脚本
├── docs/               # 文档
└── template.yaml       # SAM模板
```

### 🔐 权限模型
- **管理员 (admin)**: 查看所有数据，创建公开预设
- **普通用户 (user)**: 查看自己的数据+公开预设，创建私有预设

### 📊 数据统计
- **用户**: 4个（1管理员 + 3普通用户）
- **设备**: 5台音频设备
- **预设**: 15个音频配置预设

## 📚 API文档

- 📖 **[完整API文档](./API_DOCUMENTATION.md)** - 详细的接口说明和示例
- ⚡ **[快速参考](./API_QUICK_REFERENCE.md)** - API概览和常用操作
- 🔬 **[Postman集合](./AudioDeviceAPI.postman_collection.json)** - 导入测试

### 🚀 API基础信息
```
Base URL: https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api
认证方式: Bearer Token (JWT)
```

### 🎯 主要端点
| 功能 | 方法 | 端点 | 认证 |
|------|------|------|------|
| 用户登录 | `POST` | `/auth/login` | ❌ |
| 获取设备 | `GET` | `/devices` | ✅ |
| 获取预设 | `GET` | `/presets` | ✅ |
| 创建预设 | `POST` | `/presets` | ✅ |
| 应用预设 | `POST` | `/devices/{id}/apply-preset` | ✅ |

## 👤 演示账户
| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | `admin@demo.com` | `AdminPass123!` |
| 用户 | `alice@demo.com` | `UserPass123!` |

## 🚀 快速开始

### 前提条件
- Node.js 18+ 
- AWS CLI 配置
- SAM CLI 安装

### 安装和部署
```bash
# 1. 安装依赖
npm install

# 2. 构建项目
sam build

# 3. 部署到AWS (dev环境)
sam deploy --config-env dev

# 4. 查看API端点
sam list stack-outputs --stack-name audio-device-backend-dev
```

### 🧪 测试API
```bash
# 运行权限测试
npm run test:permissions

# 查看数据库统计
npm run data:stats

# 创建演示用户
npm run users:complete
```

## 🛠️ 开发脚本

| 命令 | 描述 |
|------|------|
| `npm run deploy` | 部署到AWS |
| `npm run test:permissions` | 权限验证测试 |
| `npm run data:stats` | 数据库统计 |
| `npm run data:clear` | 清空测试数据 |
| `npm run users:complete` | 创建完整用户数据 |

## 🏗️ 架构设计

### DynamoDB单表设计
```
PK                          SK        EntityType
USER#{user_id}             PROFILE   User
DEVICE#{device_id}         DEVICE    Device  
PRESET#{preset_id}         PRESET    Preset
```

### 权限验证流程
1. API Gateway → Cognito授权
2. Lambda函数 → 提取JWT用户信息
3. 业务逻辑 → 基于角色权限过滤数据

## 🐛 故障排除

### 常见问题
- **部署失败**: 检查AWS凭证和SAM CLI版本
- **认证失败**: 验证Cognito配置和JWT token
- **权限错误**: 确认用户角色和权限设置

### 日志查看
```bash
# 查看Lambda函数日志
sam logs -n GetDevicesFunction --stack-name audio-device-backend-dev --tail

# 查看API Gateway日志
aws logs tail /aws/apigateway/AudioDeviceAPI --follow
```

## 📈 监控指标

- **API调用数**: CloudWatch Metrics
- **错误率**: Lambda错误统计
- **响应时间**: X-Ray追踪
- **数据库性能**: DynamoDB指标

---

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 打开Pull Request

## 📄 许可证

本项目基于MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情

---

*最后更新: 2025-09-23 | 版本: v1.0*