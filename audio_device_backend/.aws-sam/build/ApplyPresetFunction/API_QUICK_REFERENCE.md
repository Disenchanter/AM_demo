# API 快速参考

## 🚀 Base URL
```
https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api
```

## 🔐 认证
```
Authorization: Bearer <JWT_TOKEN>
```

## 📋 API端点总览

### 🔑 用户认证
| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `POST` | `/auth/login` | 用户登录 | ❌ |
| `POST` | `/auth/register` | 用户注册 | ❌ |
| `GET` | `/auth/profile` | 获取当前用户资料 | ✅ |
| `GET` | `/users/profile` | 获取当前用户资料 | ✅ |
| `GET` | `/users/{user_id}` | 获取指定用户资料 | ✅ |

### 🔧 设备管理
| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/devices` | 获取设备列表 | ✅ |
| `PUT` | `/devices/{device_id}` | 更新设备状态 | ✅ |

### 🎵 预设管理
| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/presets` | 获取所有预设 | ✅ |
| `GET` | `/devices/{device_id}/presets` | 获取设备预设 | ✅ |
| `POST` | `/presets` | 创建预设 | ✅ |
| `POST` | `/devices/{device_id}/apply-preset` | 应用预设到设备 | ✅ |

## 👤 演示账户
| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | `admin@demo.com` | `AdminPass123!` |
| 用户 | `alice@demo.com` | `UserPass123!` |

## 📊 权限矩阵
| 操作 | 管理员 | 普通用户 |
|------|--------|----------|
| 查看所有设备 | ✅ | ❌ (只能查看自己的) |
| 查看所有预设 | ✅ | ❌ (自己的+公开的) |
| 创建公开预设 | ✅ | ❌ |
| 创建私有预设 | ✅ | ✅ |
| 应用预设 | ✅ | ✅ (自己设备) |

## 🛠️ 快速测试

### 登录获取Token
```bash
curl -X POST \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","password":"AdminPass123!"}'
```

### 获取设备列表
```bash
curl -X GET \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/devices \
  -H 'Authorization: Bearer <TOKEN>'
```

### 获取预设列表
```bash
curl -X GET \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/presets \
  -H 'Authorization: Bearer <TOKEN>'
```

## 📝 音频配置格式
```json
{
  "volume": 0.75,           // 0.0-1.0
  "eq": [0, 2, -1, 3, 0],   // 5段EQ, -12到+12dB
  "reverb": 0.3             // 0.0-1.0
}
```

## ⚡ 响应状态码
- `200` - 成功
- `201` - 创建成功  
- `400` - 请求错误
- `401` - 认证失败
- `403` - 权限不足
- `404` - 资源不存在
- `500` - 服务器错误