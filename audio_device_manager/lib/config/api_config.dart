class ApiConfig {
  // API Gateway URL for the current environment
  static const String baseUrl = 'https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev';
  
  // API endpoints
  static const String devicesEndpoint = '/api/devices';
  static const String presetsEndpoint = '/api/presets';
  static const String authEndpoint = '/api/auth';
  
  // Request timeout
  static const Duration requestTimeout = Duration(seconds: 30);
  
  // Authentication storage keys
  static const String authTokenKey = 'auth_token';
  static const String userIdKey = 'user_id';
  static const String usernameKey = 'username';
}