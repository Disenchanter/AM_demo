# Audio Device Manager - Backend

## 🎵 Project Overview

AWS Serverless backend for the Audio Device Management system, supporting multi-user device control and preset orchestration.

### 🏗️ Tech Stack
- **API**: AWS API Gateway + Lambda (Node.js 20.x)
- **Authentication**: AWS Cognito (JWT)
- **Database**: DynamoDB (single-table design)
- **Deployment**: AWS SAM CLI
- **Authorization**: Role-based access control (RBAC)

### 📁 Project Structure
```
audio_device_backend/
├── lambda/              # Lambda functions
│   ├── devices/         # Device management
│   ├── presets/         # Preset management  
│   └── users/           # User management
├── shared/              # Shared models and utilities
│   ├── models/          # Data models
│   └── utils/           # Helper functions
├── scripts/             # Maintenance scripts
├── docs/                # Documentation
└── template.yaml        # SAM template
```

### 🔐 Permission Model
- **Administrator (admin)**: View all data, create public presets
- **Standard user (user)**: View personal data and public presets, create private presets

### 📊 Data Snapshot
- **Users**: 4 (1 admin + 3 standard users)
- **Devices**: 5 audio devices
- **Presets**: 15 audio configuration presets

## 📚 API Documentation

- 📖 **[Full API Documentation](./API_DOCUMENTATION.md)** – Detailed endpoint descriptions and examples
- ⚡ **[Quick Reference](./API_QUICK_REFERENCE.md)** – Overview of common operations
- 🔬 **[Postman Collection](./AudioDeviceAPI.postman_collection.json)** – Importable testing suite

### 🚀 API Basics
```
Base URL: https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api
Authentication: Bearer token (JWT)
```
### 🎯 Key Endpoints
| Feature | Method | Endpoint | Auth |
|------|------|------|------|
| User login | `POST` | `/auth/login` | ❌ |
| List devices | `GET` | `/devices` | ✅ |
| List presets | `GET` | `/presets` | ✅ |
| Create preset | `POST` | `/presets` | ✅ |
| Apply preset | `POST` | `/devices/{id}/apply-preset` | ✅ |

## 👤 Demo Accounts
| Role | Email | Password |
|------|------|------|
| Administrator | `admin@demo.com` | `AdminPass123!` |
| User | `alice@demo.com` | `UserPass123!` |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- AWS CLI configured
- SAM CLI installed

### Installation & Deployment
```bash
# 1. Install dependencies
npm install

# 2. Build the project
sam build

# 3. Deploy to AWS (dev environment)
sam deploy --config-env dev

# 4. Inspect API outputs
sam list stack-outputs --stack-name audio-device-backend-dev
```

### 🧪 Testing the API
```bash
# Validate permissions
npm run test:permissions

# Show database statistics
npm run data:stats

# Provision demo users
npm run users:complete
```

## 🛠️ Development Scripts

| Command | Description |
|------|------|
| `npm run deploy` | Deploy to AWS |
| `npm run test:permissions` | Permission validation suite |
| `npm run data:stats` | Database statistics |
| `npm run data:clear` | Remove seeded data |
| `npm run users:complete` | Seed complete demo user set |

## 🏗️ Architecture

### DynamoDB Single-table Layout
```
PK                          SK        EntityType
USER#{user_id}             PROFILE   User
DEVICE#{device_id}         DEVICE    Device  
PRESET#{preset_id}         PRESET    Preset
```

### Authorization Workflow
1. API Gateway → Cognito authorizer validation
2. Lambda function → Extract JWT claims
3. Business logic → Apply role-based filters

## 🐛 Troubleshooting

### Common Issues
- **Deployment failures**: Verify AWS credentials and SAM CLI version.
- **Authentication failures**: Confirm Cognito configuration and JWT token validity.
- **Authorization errors**: Ensure user roles and permissions are aligned.

### Log Inspection
```bash
# Tail Lambda function logs
sam logs -n GetDevicesFunction --stack-name audio-device-backend-dev --tail

# Tail API Gateway logs
aws logs tail /aws/apigateway/AudioDeviceAPI --follow
```

## 📈 Observability

- **API Call Volume**: CloudWatch metrics
- **Error Rate**: Lambda failure counts
- **Latency**: AWS X-Ray traces
- **Database Health**: DynamoDB performance metrics

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push the branch (`git push origin feature/amazing-feature`)
5. Open a pull request

## 📄 License

Distributed under the MIT License – see [LICENSE](LICENSE) for details.

---

*Last updated: 2025-09-23 | Version: v1.0*