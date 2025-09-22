import "dart:convert";
import "package:http/http.dart" as http;
import "../config/api_config.dart";
import "../models/models.dart";

class DeviceApiService {
  Future<List<Device>> getDevices(String token) async {
    try {
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.devicesEndpoint}"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data["success"] == true && data["data"] != null) {
          final deviceList = data["data"]["devices"] as List<dynamic>? ?? [];
          return deviceList.map((item) => Device.fromBackend(item)).toList();
        }
      }
      return [];
    } catch (e) {
      print("Error getting devices: $e");
      return [];
    }
  }

  Future<bool> updateDevice(String token, String deviceId, Device device) async {
    try {
      final response = await http.put(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.devicesEndpoint}/$deviceId"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({
          "deviceName": device.name,
          "state": {
            "volume": device.volume,
            "eq": device.eqSettings.frequencies,
            "reverb": device.reverb,
          },
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      print("Error updating device: $e");
      return false;
    }
  }
}
