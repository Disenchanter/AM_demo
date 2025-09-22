import "dart:convert";
import "package:http/http.dart" as http;
import "../config/api_config.dart";
import "../models/models.dart";

class PresetApiService {
  Future<List<Preset>> getPresets(String token) async {
    try {
      print("PresetApiService: Getting presets with token: ${token.substring(0, 20)}...");
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.presetsEndpoint}"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
      );
      
      print("PresetApiService: Request headers: {Content-Type: application/json, Authorization: Bearer ${token.substring(0, 20)}...}");

      print("PresetApiService: Get presets response status: ${response.statusCode}");
      print("PresetApiService: Get presets response body: ${response.body}");

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data["success"] == true && data["data"] != null) {
          final presetList = data["data"]["presets"] as List<dynamic>? ?? [];
          final presets = presetList.map((item) => Preset.fromBackend(item)).toList();
          print("PresetApiService: Loaded ${presets.length} presets");
          return presets;
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
      print("PresetApiService: Creating preset '${preset.name}' - independent of device");
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.presetsEndpoint}"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({
          "name": preset.name,
          "description": preset.description,
          "volume": preset.volume,
          "eq": preset.eqSettings.frequencies,
          "reverb": preset.reverb,
          "is_public": preset.isPublic,
          "category": "custom",
        }),
      );

      print("PresetApiService: Create response status: ${response.statusCode}");
      print("PresetApiService: Create response body: ${response.body}");
      return response.statusCode == 201;
    } catch (e) {
      print("Error creating preset: $e");
      return false;
    }
  }

  Future<bool> applyPreset(String token, String presetId, String deviceId) async {
    try {
      print("PresetApiService: Applying preset $presetId to device $deviceId");
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.devicesEndpoint}/$deviceId/apply-preset"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({
          "preset_id": presetId,
        }),
      );

      print("PresetApiService: Apply response status: ${response.statusCode}");
      print("PresetApiService: Apply response body: ${response.body}");
      
      if (response.statusCode == 200) {
        try {
          final responseData = jsonDecode(response.body);
          if (responseData is Map<String, dynamic> && responseData["success"] == true) {
            print("PresetApiService: Preset applied successfully");
            return true;
          } else {
            print("PresetApiService: Server returned success=false or invalid response format");
          }
        } catch (e) {
          print("PresetApiService: Could not parse response JSON, but status 200: $e");
          return true;
        }
      }
      
      return false;
    } catch (e) {
      print("PresetApiService: Exception during preset application: $e");
      return false;
    }
  }
}
