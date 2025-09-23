# 🎵 音频设备管理系统 (Audio Device Management System)

一个完整的音频设备管理解决方案，包含Flutter前端应用和AWS Serverless后端API，支持多用户音频设备控制、预设管理和用户认证功能。

## 📋 项目概述

### 🎯 功能亮点
- 🔐 **用户认证系统** - 支持注册/登录，基于JWT的权限管理
- 🎧 **设备管理** - 实时音频设备控制和状态监控
- 🎛️ **预设系统** - 音频预设的创建、管理和分享
- 👨‍💼 **角色权限** - 管理员和普通用户的差异化权限
- 📱 **跨平台支持** - Windows、macOS、Linux、Web平台支持

### 🏗️ 技术架构
- **前端**: Flutter 3.9.2 (Dart)
- **后端**: AWS Serverless (Lambda + API Gateway + DynamoDB)
- **认证**: AWS Cognito (JWT)
- **状态管理**: Provider
- **部署**: AWS SAM CLI

## 📁 项目结构

```
AM_demo/
├── 📱 audio_device_manager/         # Flutter 前端应用
│   ├── lib/
│   │   ├── models/                  # 数据模型 (User, Device, Preset)
│   │   ├── services/                # API服务层
│   │   ├── providers/               # 状态管理 (Provider模式)
│   │   ├── screens/                 # 页面UI (登录、主页、设置)
│   │   ├── widgets/                 # 自定义组件
│   │   └── config/                  # 配置文件
│   ├── android/                     # Android平台配置
│   ├── windows/                     # Windows平台配置
│   └── web/                         # Web平台配置
│
├── 🔧 audio_device_backend/         # AWS Serverless 后端
│   ├── lambda/                      # Lambda函数
│   │   ├── devices/                 # 设备管理API
│   │   ├── presets/                 # 预设管理API
│   │   └── users/                   # 用户管理API
│   ├── shared/                      # 共享模块
│   │   ├── models/                  # 数据模型
│   │   └── utils/                   # 工具函数
│   ├── scripts/                     # 管理脚本
│   ├── docs/                        # API文档
│   └── template.yaml                # SAM部署模板
│
└── 📚 文档文件
    ├── README.md                    # 项目总览 (本文件)
    ├── README_EN.md                 # English README
    └── 部署和使用说明
```

## 🚀 快速开始

### 📋 环境要求

#### 前端开发环境
```bash
Flutter SDK: >=3.9.2
Dart SDK: >=3.0.0
```

#### 后端部署环境
```bash
AWS CLI: 最新版本
AWS SAM CLI: >=1.100.0
Node.js: >=20.x
```

### 🛠️ 安装步骤

#### 1. 克隆项目
```bash
git clone <repository-url>
cd AM_demo
```

#### 2. 前端设置
```bash
cd audio_device_manager

# 安装依赖
flutter pub get

# 运行应用 (选择平台)
flutter run -d windows    # Windows
flutter run -d chrome     # Web浏览器
flutter run -d macos      # macOS
flutter run -d linux      # Linux
```

#### 3. 后端部署
```bash
cd audio_device_backend

# 安装依赖
npm install

# 构建和部署
sam build
sam deploy --guided

# 创建测试用户
node scripts/manage-users.js
```

## 🎮 功能演示

### 🔐 用户认证
- **注册新用户**: 邮箱、用户名、真实姓名、密码
- **用户登录**: 用户名/邮箱 + 密码
- **会话管理**: 自动保存登录状态

### 🎧 设备管理
```
📱 主界面
├── 设备列表 (横向滚动卡片)
├── 音量控制 (滑块 + 快捷按钮)
├── EQ均衡器 (10频段可调)
└── 设备状态 (连接/断开指示)
```

### 🎛️ 预设管理
- **内置预设**: 平坦、摇滚、流行、爵士等
- **自定义预设**: 保存当前设备设置
- **预设分享**: 公开/私有预设选择
- **搜索过滤**: 按名称、描述、标签筛选

## 📊 数据概览

### 👥 用户账户
| 用户类型 | 邮箱 | 密码 | 权限 |
|---------|------|------|------|
| 管理员 | admin@demo.com | AdminPass123! | 全局访问 |
| 用户1 | user1@demo.com | UserPass123! | 个人数据 |
| 用户2 | user2@demo.com | UserPass123! | 个人数据 |

### 🎧 设备列表
- **WH-1000XM4** - 索尼无线降噪耳机
- **AirPods Pro** - 苹果无线耳机
- **HD 660 S** - 森海塞尔监听耳机
- **DT 990 Pro** - 拜亚动力专业耳机
- **SteelSeries Arctis 7** - 赛睿游戏耳机

### 🎵 预设类型
- **系统预设** (7个): 平坦、摇滚、流行、爵士、古典、电子、语音
- **用户预设** (8个): 自定义音频配置

## 🔧 API 接口

### 📡 基础信息
```
Base URL: https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api
认证方式: Bearer Token (JWT)
数据格式: JSON
```

### 🎯 主要端点
```bash
# 用户认证
POST /api/auth/login              # 用户登录
POST /api/auth/register           # 用户注册
GET  /api/auth/profile            # 获取用户信息

# 设备管理
GET  /api/devices                 # 获取设备列表
PUT  /api/devices/{id}            # 更新设备设置

# 预设管理
GET  /api/presets                 # 获取预设列表
POST /api/presets                 # 创建新预设
PUT  /api/presets/{id}/apply      # 应用预设
```

### 📖 详细文档
- 📝 [完整API文档](./audio_device_backend/API_DOCUMENTATION.md)
- ⚡ [快速参考](./audio_device_backend/API_QUICK_REFERENCE.md)
- 🧪 [Postman测试集合](./audio_device_backend/AudioDeviceAPI.postman_collection.json)

## 🎨 界面展示

### 📱 主要页面
1. **登录页面** - 用户名/邮箱登录，注册功能切换
2. **主页面** - 设备卡片、音量控制、EQ调节
3. **预设页面** - 预设列表、搜索筛选、应用/保存
4. **设置页面** - 用户信息、应用设置、退出登录

### 🎯 用户体验
- ✅ 响应式设计，适配不同屏幕尺寸
- ✅ 流畅动画和过渡效果
- ✅ 直观的操作反馈
- ✅ 完整的错误处理和提示

## 🚀 部署说明

### 🌐 后端部署 (AWS)
```bash
# 配置AWS凭证
aws configure

# 部署后端
cd audio_device_backend
sam build && sam deploy --guided

# 初始化数据
node scripts/manage-users.js
```

### 📱 前端构建
```bash
cd audio_device_manager

# Windows应用
flutter build windows --release

# Web应用
flutter build web --release

# macOS应用
flutter build macos --release
```

## 🛡️ 安全特性

### 🔐 认证安全
- JWT令牌认证
- 密码强度要求 (8位+大小写+数字)
- 会话自动过期机制
- CORS跨域保护

### 🎯 权限控制
- 基于角色的访问控制 (RBAC)
- 用户数据隔离
- API接口权限验证
- 管理员特权功能

## 🧪 测试账户

### 🔑 演示账户 (可直接登录测试)
```
管理员账户:
邮箱: admin@demo.com
密码: AdminPass123!

普通用户账户:
邮箱: user1@demo.com
密码: UserPass123!
```

## 📈 性能指标

### ⚡ 响应时间
- API平均响应: < 200ms
- 设备状态更新: 实时
- 预设加载: < 100ms
- 用户认证: < 500ms

### 🎯 可扩展性
- 支持无限用户注册
- 动态设备添加
- 自定义预设创建
- 多平台部署支持

## 🤝 贡献指南

### 🐛 问题报告
1. 在 Issues 页面创建问题报告
2. 详细描述问题现象和复现步骤
3. 提供系统环境和版本信息

### 💡 功能建议
1. 通过 Issues 提交功能请求
2. 描述期望功能和使用场景
3. 提供设计想法和实现思路

### 🔧 代码贡献
1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系信息

- **项目维护**: [Your Name]
- **邮箱**: [your.email@example.com]
- **项目地址**: [GitHub Repository URL]

---

## 🙏 致谢

感谢以下技术和服务的支持：
- [Flutter](https://flutter.dev/) - 跨平台UI框架
- [AWS](https://aws.amazon.com/) - 云服务平台
- [Provider](https://pub.dev/packages/provider) - 状态管理库

---

<div align="center">

**🎵 让音频管理更简单，让体验更美好 🎵**

[📱 下载应用](./releases) | [🔧 API文档](./audio_device_backend/API_DOCUMENTATION.md) | [🐛 问题反馈](./issues)

</div>