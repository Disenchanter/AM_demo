import "dart:convert";
import "package:http/http.dart" as http;
import "../config/api_config.dart";
import "../models/models.dart";

class PresetApiService {
  Future<List<Preset>> getPresets(String token) async {
    try {
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.presetsEndpoint}"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data["success"] == true && data["data"] != null) {
          final presetList = data["data"]["presets"] as List<dynamic>? ?? [];
          return presetList.map((item) => Preset.fromBackend(item)).toList();
        }
      }
      return [];
    } catch (e) {
      print("Error getting presets: $e");
      return [];
    }
  }

  Future<bool> createPreset(String token, Preset preset) async {
    try {
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.presetsEndpoint}"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({
          "presetName": preset.name,
          "description": preset.description,
          "eq": preset.eqSettings.frequencies,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      print("Error creating preset: $e");
      return false;
    }
  }

  Future<bool> applyPreset(String token, String presetId, String deviceId) async {
    try {
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.presetsEndpoint}/$presetId/apply"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({
          "deviceId": deviceId,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      print("Error applying preset: $e");
      return false;
    }
  }
}
