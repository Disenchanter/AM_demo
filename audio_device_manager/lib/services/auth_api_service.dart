import "dart:convert";
import "package:http/http.dart" as http;
import "../config/api_config.dart";
import "../models/models.dart";

class AuthApiService {
  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.authEndpoint}/login"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "username": username,
          "password": password,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          "success": true,
          "data": data,
        };
      } else {
        return {
          "success": false,
          "error": "Login failed: ${response.statusCode}",
        };
      }
    } catch (e) {
      return {
        "success": false,
        "error": "Network error: $e",
      };
    }
  }

  Future<Map<String, dynamic>> register(String username, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.authEndpoint}/register"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "username": username,
          "email": email,
          "password": password,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          "success": true,
          "data": data,
        };
      } else {
        return {
          "success": false,
          "error": "Registration failed: ${response.statusCode}",
        };
      }
    } catch (e) {
      return {
        "success": false,
        "error": "Network error: $e",
      };
    }
  }

  Future<Map<String, dynamic>> getProfile(String token) async {
    try {
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.authEndpoint}/profile"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          "success": true,
          "data": data,
        };
      } else {
        return {
          "success": false,
          "error": "Failed to get profile: ${response.statusCode}",
        };
      }
    } catch (e) {
      return {
        "success": false,
        "error": "Network error: $e",
      };
    }
  }
}
