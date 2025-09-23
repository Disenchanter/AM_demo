# 音频设备管理系统 API 文档

## 📋 目录
- [API概述](#api概述)
- [认证授权](#认证授权)
- [用户认证接口](#用户认证接口)
- [设备管理接口](#设备管理接口)
- [音频预设接口](#音频预设接口)
- [用户资料接口](#用户资料接口)
- [数据模型](#数据模型)
- [错误码说明](#错误码说明)

---

## API概述

### 基础信息
- **Base URL**: `https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api`
- **协议**: HTTPS
- **数据格式**: JSON
- **认证方式**: JWT Bearer Token (AWS Cognito)

### 权限模型
- **管理员 (admin)**: 可查看所有数据，可创建公开预设
- **普通用户 (user)**: 只能查看自己的数据，可创建私有预设，可查看公开预设

---

## 认证授权

### 认证头格式
```
Authorization: Bearer <JWT_TOKEN>
```

### 获取Token
通过 `/api/auth/login` 接口获取JWT token

### 权限验证
大部分接口需要JWT认证，除了：
- `POST /api/auth/login` - 登录接口
- `POST /api/auth/register` - 注册接口

---

## 用户认证接口

### 用户登录
```http
POST /api/auth/login
```

**请求体**:
```json
{
  "email": "admin@demo.com",
  "password": "AdminPass123!"
}
```

**响应 200**:
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "userId": "efb542c2-569b-45d1-80f0-0b5a85d340ff",
      "email": "admin@demo.com",
      "username": "admin",
      "fullName": "系统管理员",
      "role": "admin",
      "emailVerified": true,
      "status": "active"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJSUzI1NiIs...",
      "tokenType": "Bearer",
      "expiresIn": 3600
    },
    "sessionInfo": {
      "loginTime": "2025-09-23T10:30:15.123Z",
      "sessionId": "sess_abc123"
    }
  }
}
```

**错误 401**:
```json
{
  "error": "登录失败",
  "message": "邮箱或密码错误"
}
```

### 用户注册
```http
POST /api/auth/register
```

**请求体**:
```json
{
  "email": "newuser@demo.com",
  "password": "UserPass123!",
  "fullName": "新用户",
  "username": "newuser"
}
```

**响应 201**:
```json
{
  "success": true,
  "message": "用户注册成功",
  "data": {
    "userId": "new-user-id-123",
    "email": "newuser@demo.com",
    "status": "pending_verification"
  }
}
```

---

## 设备管理接口

### 获取设备列表
```http
GET /api/devices
Authorization: Bearer <token>
```

**响应 200**:
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
        "deviceName": "我的音频设备",
        "deviceModel": "Demo Audio Device v2.0",
        "ownerId": "user-id-123",
        "isOnline": true,
        "lastSeen": "2025-09-23T10:30:15.123Z",
        "state": {
          "volume": 0.75,
          "eq": [0, 2, -1, 3, 0],
          "reverb": 0.3,
          "lastPresetId": "preset-123",
          "syncVersion": 2
        },
        "createdAt": "2025-09-21T10:56:18.553Z",
        "updatedAt": "2025-09-23T10:30:15.123Z"
      }
    ],
    "count": 1,
    "userRole": "user"
  }
}
```

### 更新设备状态
```http
PUT /api/devices/{device_id}
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "volume": 0.8,
  "eq": [0, 2, -1, 3, 0],
  "reverb": 0.4
}
```

**响应 200**:
```json
{
  "success": true,
  "message": "设备状态更新成功",
  "data": {
    "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
    "state": {
      "volume": 0.8,
      "eq": [0, 2, -1, 3, 0],
      "reverb": 0.4,
      "syncVersion": 3,
      "updatedAt": "2025-09-23T10:30:15.123Z"
    }
  }
}
```

---

## 音频预设接口

### 获取预设列表
```http
GET /api/presets
Authorization: Bearer <token>
```
或
```http
GET /api/devices/{device_id}/presets
Authorization: Bearer <token>
```

**响应 200**:
```json
{
  "success": true,
  "data": {
    "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
    "presets": [
      {
        "presetId": "542379c8-5563-42a7-9d10-566269053a27",
        "presetName": "古典音乐",
        "category": "music",
        "description": "古典音乐专用音频配置",
        "isPublic": false,
        "createdBy": "user-id-123",
        "creatorRole": "user",
        "usageCount": 15,
        "profile": {
          "volume": 0.65,
          "eq": [0, -2, 1, 2, -1],
          "reverb": 0.7
        },
        "createdAt": "2025-09-21T10:56:15.284Z",
        "updatedAt": "2025-09-21T10:56:15.284Z"
      }
    ],
    "count": 1,
    "userRole": "user"
  }
}
```

### 创建预设
```http
POST /api/presets
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "presetName": "我的自定义预设",
  "category": "custom",
  "description": "个人定制音频预设",
  "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
  "isPublic": false,
  "profile": {
    "volume": 0.7,
    "eq": [2, 0, -1, 3, 1],
    "reverb": 0.5
  }
}
```

**响应 201**:
```json
{
  "success": true,
  "message": "预设创建成功",
  "data": {
    "presetId": "new-preset-id-456",
    "presetName": "我的自定义预设",
    "category": "custom",
    "isPublic": false,
    "createdBy": "user-id-123",
    "createdAt": "2025-09-23T10:30:15.123Z"
  }
}
```

### 应用预设到设备
```http
POST /api/devices/{device_id}/apply-preset
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "presetId": "542379c8-5563-42a7-9d10-566269053a27"
}
```

**响应 200**:
```json
{
  "success": true,
  "message": "预设应用成功",
  "data": {
    "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
    "presetId": "542379c8-5563-42a7-9d10-566269053a27",
    "appliedState": {
      "volume": 0.65,
      "eq": [0, -2, 1, 2, -1],
      "reverb": 0.7,
      "lastPresetId": "542379c8-5563-42a7-9d10-566269053a27",
      "syncVersion": 4
    }
  }
}
```

---

## 用户资料接口

### 获取当前用户资料
```http
GET /api/users/profile
Authorization: Bearer <token>
```
或
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

**响应 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "efb542c2-569b-45d1-80f0-0b5a85d340ff",
      "email": "admin@demo.com",
      "username": "admin",
      "fullName": "系统管理员",
      "role": "admin",
      "avatarUrl": null,
      "emailVerified": true,
      "status": "active",
      "preferences": {
        "theme": "dark",
        "language": "zh-CN",
        "notifications": {
          "email": true,
          "push": true,
          "sound": true
        },
        "audio": {
          "defaultVolume": 0.7,
          "autoEq": true,
          "preferredQuality": "high"
        }
      },
      "profile": {
        "bio": "",
        "location": "",
        "website": "",
        "socialLinks": {
          "twitter": "",
          "github": "",
          "linkedin": ""
        }
      },
      "stats": {
        "devicesCount": 2,
        "presetsCount": 6,
        "lastLogin": "2025-09-23T10:30:15.123Z",
        "loginCount": 15,
        "totalSessionTime": 7200
      },
      "createdAt": "2025-09-21T10:56:11.318Z",
      "updatedAt": "2025-09-23T10:30:15.123Z",
      "lastActiveAt": "2025-09-23T10:30:15.123Z"
    }
  }
}
```

### 获取指定用户资料
```http
GET /api/users/{user_id}
Authorization: Bearer <token>
```

**响应 200** (仅管理员可访问其他用户资料):
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user-id-123",
      "username": "alice",
      "fullName": "Alice Johnson",
      "role": "user",
      "status": "active",
      "publicProfile": {
        "bio": "音乐爱好者",
        "location": "北京",
        "joinDate": "2025-09-21T10:56:14.382Z"
      },
      "stats": {
        "devicesCount": 1,
        "publicPresetsCount": 0
      }
    }
  }
}
```

---

## 数据模型

### 音频配置 (AudioProfile)
```json
{
  "volume": 0.75,        // 音量 (0.0-1.0)
  "eq": [0, 2, -1, 3, 0], // 5段均衡器 (-12到+12 dB)
  "reverb": 0.3,         // 混响效果 (0.0-1.0)
  "lastPresetId": "preset-123", // 最后应用的预设ID
  "syncVersion": 2,      // 同步版本号
  "updatedAt": "2025-09-23T10:30:15.123Z"
}
```

### 预设分类
- `music` - 音乐
- `gaming` - 游戏
- `movie` - 电影
- `voice` - 语音
- `custom` - 自定义

### 用户角色
- `admin` - 管理员
- `user` - 普通用户

### 账户状态
- `active` - 活跃
- `inactive` - 非活跃
- `suspended` - 暂停

---

## 错误码说明

### HTTP状态码

| 状态码 | 描述 | 说明 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 认证失败或token无效 |
| 403 | Forbidden | 权限不足 |
| 404 | Not Found | 资源不存在 |
| 500 | Internal Server Error | 服务器内部错误 |

### 错误响应格式
```json
{
  "error": "错误类型",
  "message": "详细错误描述",
  "details": "技术细节（可选）",
  "code": "ERROR_CODE（可选）"
}
```

### 常见错误

#### 认证错误
```json
{
  "error": "登录失败",
  "message": "邮箱或密码错误"
}
```

#### 权限错误
```json
{
  "error": "权限不足",
  "message": "只有管理员可以创建公开预设"
}
```

#### 资源不存在
```json
{
  "error": "资源不存在",
  "message": "指定的设备不存在"
}
```

#### 参数验证错误
```json
{
  "error": "参数验证失败",
  "message": "音量值必须在0到1之间",
  "details": "volume: 1.5 is not valid"
}
```

---

## 演示账户

用于测试的演示账户：

| 角色 | 邮箱 | 密码 | 权限说明 |
|------|------|------|----------|
| **管理员** | admin@demo.com | AdminPass123! | 查看所有数据，创建公开预设 |
| **普通用户** | alice@demo.com | UserPass123! | 查看自己的数据，创建私有预设 |
| **普通用户** | bob@demo.com | UserPass123! | 查看自己的数据，创建私有预设 |
| **普通用户** | carol@demo.com | UserPass123! | 查看自己的数据，创建私有预设 |

---

## 使用示例

### 完整的工作流程

1. **用户登录**
```bash
curl -X POST \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","password":"AdminPass123!"}'
```

2. **获取设备列表**
```bash
curl -X GET \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/devices \
  -H 'Authorization: Bearer <your-jwt-token>'
```

3. **创建音频预设**
```bash
curl -X POST \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/presets \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "presetName": "我的预设",
    "category": "music",
    "description": "个人定制",
    "deviceId": "device-id-here",
    "isPublic": false,
    "profile": {
      "volume": 0.8,
      "eq": [2, 0, -1, 3, 1],
      "reverb": 0.5
    }
  }'
```

4. **应用预设到设备**
```bash
curl -X POST \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/devices/{device_id}/apply-preset \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{"presetId": "preset-id-here"}'
```

---

*文档版本: v1.0 | 最后更新: 2025-09-23*