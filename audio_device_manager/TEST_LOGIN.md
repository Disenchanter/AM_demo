# 测试登录信息

## 测试用户账户

您可以使用以下账户登录应用：

### 管理员账户
- **邮箱**: admin@demo.com
- **密码**: TestPassword123!

### 如何测试：

1. 启动应用（如果未启动）：
   ```bash
   flutter run -d windows
   ```

2. 在登录界面输入上述账户信息

3. 登录后，您可以：
   - 查看设备列表
   - 管理设备预设
   - 测试音频配置

### 已知问题
- 如果遇到HTTP错误，请确保后端服务正在运行
- 网络连接问题可能导致API调用失败

### 调试信息
应用会在调试控制台显示详细的API请求和响应日志，方便排查问题。

### API端点
- 基础URL: https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev
- 认证方式: JWT Bearer Token