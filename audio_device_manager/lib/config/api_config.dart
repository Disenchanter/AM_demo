class ApiConfig {
  // API Gateway URL - 已更新为正确的环境
  static const String baseUrl = 'https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev';
  
  // API端点
  static const String devicesEndpoint = '/api/devices';
  static const String presetsEndpoint = '/api/presets';
  static const String authEndpoint = '/api/auth';
  
  // 请求超时时间
  static const Duration requestTimeout = Duration(seconds: 30);
  
  // 认证相关
  static const String authTokenKey = 'auth_token';
  static const String userIdKey = 'user_id';
  static const String usernameKey = 'username';
}