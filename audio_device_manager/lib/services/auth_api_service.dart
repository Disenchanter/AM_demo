import "dart:convert";
import "package:http/http.dart" as http;
import "../config/api_config.dart";
// import "../models/models.dart";

class AuthApiService {
  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      print("AuthApiService: Attempting login for username: $username");
      final requestBody = {
  "email": username, // Backend expects the field name `email`
        "password": password,
      };
      print("AuthApiService: Login request body: ${jsonEncode(requestBody)}");

      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.authEndpoint}/login"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(requestBody),
      );

      print("AuthApiService: Login response status: ${response.statusCode}");
      print("AuthApiService: Login response body: ${response.body}");

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
  return responseData; // Pass through backend response without additional wrapping
      } else {
        final errorData = jsonDecode(response.body);
        return {
          "success": false,
          "error": "Login failed: ${response.statusCode}",
          "details": errorData,
        };
      }
    } catch (e) {
      print("AuthApiService: Login error: $e");
      return {
        "success": false,
        "error": "Network error: $e",
      };
    }
  }

  Future<Map<String, dynamic>> register(String username, String email, String password, String fullName) async {
    try {
      print("AuthApiService: Attempting register for email: $email, username: $username, fullName: $fullName");
      final requestBody = {
        "email": email,
        "password": password,
  "fullName": fullName,  // Backend expects `fullName` to store the real name
  "username": username.isNotEmpty ? username : email.split('@')[0], // `username` is optional; default to email prefix
      };
      print("AuthApiService: Register request body: ${jsonEncode(requestBody)}");

      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.authEndpoint}/register"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(requestBody),
      );

      print("AuthApiService: Register response status: ${response.statusCode}");
      print("AuthApiService: Register response body: ${response.body}");

      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          "success": true,
          "data": data,
        };
      } else {
        final errorData = jsonDecode(response.body);
        return {
          "success": false,
          "error": "Registration failed: ${response.statusCode}",
          "details": errorData,
        };
      }
    } catch (e) {
      print("AuthApiService: Register error: $e");
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
