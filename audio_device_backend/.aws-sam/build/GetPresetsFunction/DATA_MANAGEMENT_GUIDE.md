# 🔧 数据管理快速指南

## 👥 用户管理

### 已创建的用户账户

#### 管理员账户
- **邮箱**: `admin@demo.com`
- **密码**: `AdminPass123!`
- **角色**: `admin`
- **权限**: 可以访问所有设备和预设

#### 普通用户账户
1. **邮箱**: `user1@demo.com`
   - **密码**: `UserPass123!`
   - **角色**: `user`
   - **权限**: 只能访问自己的设备

2. **邮箱**: `user2@demo.com`
   - **密码**: `UserPass123!`
   - **角色**: `user`
   - **权限**: 只能访问自己的设备

### 用户管理命令

```bash
# 创建更多用户（包括管理员和普通用户）
npm run users:create

# 使用 AWS CLI 手动创建用户
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_HQjB4Dlq1 \
  --username newuser@demo.com \
  --user-attributes Name=name,Value="New User" \
  --temporary-password TempPass123! \
  --message-action SUPPRESS \
  --region us-east-1

# 设置用户永久密码
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_HQjB4Dlq1 \
  --username <username> \
  --password NewPassword123! \
  --permanent \
  --region us-east-1

# 将用户添加到组
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_HQjB4Dlq1 \
  --username <username> \
  --group-name admin \
  --region us-east-1
```

## 📊 数据管理

### 已创建的测试数据

#### 设备（4个）
- 管理员设备 1 & 2（admin@demo.com 拥有）
- user1 的设备（user1@demo.com 拥有）  
- user2 的设备（user2@demo.com 拥有）

#### 预设（11个）
- 每个设备都有 2-3 个预设（流行音乐、摇滚音乐、古典音乐等）
- 管理员创建的预设是公开的
- 普通用户的预设部分是私有的

### 数据管理命令

```bash
# 查看数据库统计信息
npm run data:stats

# 创建更多测试数据
npm run data:create

# 清空所有数据（小心使用！）
npm run data:clear

# 使用 AWS CLI 直接查询数据
aws dynamodb scan \
  --table-name AudioManagement-dev \
  --region us-east-1

# 查询特定用户的设备
aws dynamodb query \
  --table-name AudioManagement-dev \
  --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#9498a4b8-70b1-70be-e4e8-bd433568257d"}}' \
  --region us-east-1
```

## 🧪 测试 API

### 获取 JWT Token

使用 Postman 或写一个简单的脚本来获取 JWT token：

```javascript
// 示例：获取管理员token
const params = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: '2bjihn2mk2fc1n85nqulg52i09',
    AuthParameters: {
        USERNAME: 'admin@demo.com',
        PASSWORD: 'AdminPass123!'
    }
};

// 使用 AWS SDK 调用 initiateAuth
```

### API 测试

```bash
# 替换 <JWT_TOKEN> 为实际的 token

# 获取所有设备（管理员可以看到所有设备）
curl -H "Authorization: Bearer <JWT_TOKEN>" \
     https://22xspdnq08.execute-api.us-east-1.amazonaws.com/dev/api/devices

# 获取特定设备的预设
curl -H "Authorization: Bearer <JWT_TOKEN>" \
     https://22xspdnq08.execute-api.us-east-1.amazonaws.com/dev/api/devices/91a375c8-6aa7-4924-bd8d-43dc137ae1ab/presets

# 更新设备状态
curl -X PUT -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"volume": 0.8, "eq": [2, 3, -1, 4, 1]}' \
     https://22xspdnq08.execute-api.us-east-1.amazonaws.com/dev/api/devices/91a375c8-6aa7-4924-bd8d-43dc137ae1ab
```

## 🔍 监控和调试

### CloudWatch 日志

查看 Lambda 函数日志：
```bash
# 查看获取设备函数的日志
sam logs -n GetDevicesFunction --stack-name audio-device-backend-dev --tail

# 查看所有函数的日志
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/" --region us-east-1
```

### DynamoDB 数据浏览

使用 AWS Console 或 CLI：
```bash
# 扫描所有数据
aws dynamodb scan --table-name AudioManagement-dev --region us-east-1

# 查询特定设备
aws dynamodb get-item \
  --table-name AudioManagement-dev \
  --key '{"PK":{"S":"DEVICE#91a375c8-6aa7-4924-bd8d-43dc137ae1ab"},"SK":{"S":"METADATA"}}' \
  --region us-east-1
```

## 🎯 常见操作

### 添加新的管理员
```bash
# 1. 创建用户
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_HQjB4Dlq1 \
  --username newadmin@demo.com \
  --user-attributes Name=name,Value="New Admin" \
  --temporary-password TempPass123! \
  --message-action SUPPRESS \
  --region us-east-1

# 2. 添加到管理员组
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_HQjB4Dlq1 \
  --username <returned-username> \
  --group-name admin \
  --region us-east-1

# 3. 设置永久密码
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_HQjB4Dlq1 \
  --username <returned-username> \
  --password AdminPass123! \
  --permanent \
  --region us-east-1
```

### 重置用户密码
```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_HQjB4Dlq1 \
  --username <username> \
  --password NewPassword123! \
  --permanent \
  --region us-east-1
```

### 删除用户
```bash
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_HQjB4Dlq1 \
  --username <username> \
  --region us-east-1
```

## 📋 重要提醒

- ⚠️ **密码要求**: 至少8个字符，包含大小写字母和数字
- ⚠️ **权限测试**: 管理员可以看到所有数据，普通用户只能看到自己的数据
- ⚠️ **数据清理**: 使用 `npm run data:clear` 会删除所有数据，请谨慎操作
- ⚠️ **成本控制**: 测试完成后可以删除 CloudFormation 堆栈以避免费用

## 🔗 相关资源

- **用户池 ID**: `us-east-1_HQjB4Dlq1`
- **客户端 ID**: `2bjihn2mk2fc1n85nqulg52i09`
- **API Base URL**: `https://22xspdnq08.execute-api.us-east-1.amazonaws.com/dev/`
- **DynamoDB 表**: `AudioManagement-dev`
- **区域**: `us-east-1`