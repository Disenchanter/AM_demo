# Audio Device Manager - Backend

## 架构概览

这是音频设备管理器的AWS后端服务，采用Serverless架构。

### 技术栈
- **API Layer**: AWS API Gateway
- **Business Logic**: AWS Lambda (Node.js 18.x)
- **Authentication**: AWS Cognito
- **Database**: AWS DynamoDB
- **Infrastructure**: AWS SAM

### 项目结构
```
audio_device_backend/
├── lambda-functions/     # Lambda函数代码
├── shared/              # 共享工具和模型
├── infrastructure/      # AWS基础设施配置
├── tests/              # 测试文件
├── docs/               # API文档
└── scripts/            # 部署脚本
```

### API端点
- `GET /presets` - 获取所有预设
- `POST /presets` - 创建预设 (Admin only)
- `DELETE /presets/{id}` - 删除预设 (Admin only)
- `GET /device/state` - 获取设备状态
- `PUT /device/state` - 更新设备状态
- `POST /device/apply-preset` - 应用预设到设备

### 用户权限
- **Admin**: 可以创建、删除预设，管理自己的设备
- **User**: 只能读取预设、应用预设，管理自己的设备

## 快速开始

1. 安装依赖: `npm install`
2. 配置AWS凭证: `aws configure`
3. 部署基础设施: `npm run deploy`
4. 运行测试: `npm test`

## 开发指南

详细的开发指南请查看 `docs/` 目录下的文档。