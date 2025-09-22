import "package:flutter/material.dart";
import "package:shared_preferences/shared_preferences.dart";
import "../services/auth_api_service.dart";
import "../models/models.dart";
import "../config/api_config.dart";

class AuthProvider with ChangeNotifier {
  User? _currentUser;
  String? _token;
  bool _isLoading = false;
  String _errorMessage = "";

  final AuthApiService _authApiService = AuthApiService();

  User? get currentUser => _currentUser;
  String? get token => _token;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;
  bool get isLoggedIn => _currentUser != null && _token != null;

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(ApiConfig.authTokenKey);
    final userId = prefs.getString(ApiConfig.userIdKey);
    final username = prefs.getString(ApiConfig.usernameKey);
    
    if (_token != null && userId != null && username != null) {
      _currentUser = User(id: userId, username: username, email: "");
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    _setLoading(true);
    _errorMessage = "";

    final result = await _authApiService.login(username, password);
    
    if (result["success"]) {
      final data = result["data"];
      print("AuthProvider: Login data structure: $data");
      print("AuthProvider: data keys: ${data?.keys}");
      
      final tokens = data?["tokens"];
      if (tokens != null) {
        _token = tokens["idToken"];  // 使用idToken进行API授权
      } else {
        print("Warning: No tokens found in login response");
        _token = null;
      }
      
      final user = data?["user"];
      if (user != null) {
        _currentUser = User(
          id: user["id"] ?? "",
          username: user["username"] ?? username,
          email: user["email"] ?? "",
        );
      } else {
        print("Warning: No user found in login response");
        _currentUser = null;
      }

      await _saveAuthData();
      _setLoading(false);
      return true;
    } else {
      _errorMessage = result["error"];
      _setLoading(false);
      return false;
    }
  }

  Future<bool> register(String username, String email, String password) async {
    _setLoading(true);
    _errorMessage = "";

    final result = await _authApiService.register(username, email, password);
    
    if (result["success"]) {
      _setLoading(false);
      return true;
    } else {
      _errorMessage = result["error"];
      _setLoading(false);
      return false;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(ApiConfig.authTokenKey);
    await prefs.remove(ApiConfig.userIdKey);
    await prefs.remove(ApiConfig.usernameKey);
    
    _currentUser = null;
    _token = null;
    notifyListeners();
  }

  Future<void> _saveAuthData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiConfig.authTokenKey, _token ?? "");
    await prefs.setString(ApiConfig.userIdKey, _currentUser?.id ?? "");
    await prefs.setString(ApiConfig.usernameKey, _currentUser?.username ?? "");
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }
}
