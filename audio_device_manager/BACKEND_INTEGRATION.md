# Flutter 前端与 AWS 后端集成指南

## 概述

此 Flutter 应用现已集成与 AWS 后端 API 的连接功能。应用支持用户认证、设备管理和预设管理等功能。

## 配置步骤

### 1. 配置 API 端点

编辑 `lib/config/api_config.dart` 文件，替换 `baseUrl` 为实际的 API Gateway URL：

```dart
class ApiConfig {
  // 替换为实际的API Gateway URL
  static const String baseUrl = 'https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/dev';
  // ... 其他配置
}
```

### 2. 获取 API Gateway URL

从 AWS 控制台或 CloudFormation 输出中获取部署的 API Gateway URL。URL 格式通常为：
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
```

### 3. 测试连接

1. 启动 Flutter 应用
2. 进入"API 测试"页面
3. 点击各种测试按钮来验证连接

## API 端点映射

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 用户登录 | POST | `/api/auth/login` | 用户认证 |
| 用户注册 | POST | `/api/auth/register` | 新用户注册 |
| 用户资料 | GET | `/api/auth/profile` | 获取用户信息 |
| 获取设备 | GET | `/api/devices` | 获取设备列表 |
| 更新设备 | PUT | `/api/devices/{id}` | 更新设备状态 |
| 获取预设 | GET | `/api/presets` | 获取预设列表 |
| 创建预设 | POST | `/api/devices/{id}/presets` | 创建新预设 |
| 应用预设 | POST | `/api/devices/{id}/apply-preset` | 应用预设到设备 |

## 数据模型

### Device
- `device_id`: 设备唯一标识
- `device_name`: 设备名称
- `state.volume`: 音量 (0.0-1.0)
- `state.eq`: 5频段均衡器数组
- `state.reverb`: 混响值 (0.0-1.0)
- `is_online`: 设备在线状态
- `last_seen`: 最后在线时间

### Preset
- `preset_id`: 预设唯一标识
- `preset_name`: 预设名称
- `audio_profile`: 音频配置文件
- `is_public`: 是否公开预设
- `created_by`: 创建者ID

### User
- `user_id`: 用户唯一标识
- `username`: 用户名
- `email`: 邮箱地址

## 错误处理

应用包含完整的错误处理机制：

1. **网络错误**: 显示网络连接失败信息
2. **认证错误**: 显示登录失败或令牌过期信息
3. **API错误**: 显示具体的 API 错误信息
4. **数据格式错误**: 处理响应数据格式问题

## 开发调试

### 启用调试模式

在 `api_client.dart` 中添加请求日志：

```dart
print('请求URL: $url');
print('请求头: $requestHeaders');
print('请求体: ${body != null ? jsonEncode(body) : 'null'}');
print('响应状态: ${response.statusCode}');
print('响应体: ${response.body}');
```

### 本地测试

如果需要连接本地后端服务，可以设置：

```dart
static const String baseUrl = 'http://localhost:3000'; // 本地开发服务器
```

注意：iOS 模拟器可能需要特殊配置才能访问本地服务器。

## 安全注意事项

1. **令牌存储**: 认证令牌使用 SharedPreferences 安全存储
2. **HTTPS**: 生产环境必须使用 HTTPS 端点
3. **输入验证**: 客户端包含基本输入验证
4. **错误信息**: 不暴露敏感的系统信息

## 故障排除

### 常见问题

1. **连接超时**: 检查网络连接和 API Gateway 状态
2. **认证失败**: 验证用户凭证和 Cognito 配置
3. **CORS 错误**: 确保 API Gateway 正确配置 CORS
4. **数据格式错误**: 检查前后端数据模型的一致性

### 日志查看

查看 Flutter 控制台输出和 AWS CloudWatch 日志来诊断问题。

## 下一步开发

1. 添加注册页面
2. 实现设备实时状态同步
3. 添加更多音频效果参数
4. 实现离线模式支持
5. 添加设备组管理功能