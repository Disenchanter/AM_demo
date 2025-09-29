import "dart:convert";
import "package:http/http.dart" as http;
import "../config/api_config.dart";
import "../models/models.dart";

class DeviceApiService {
  Future<List<Device>> getDevices(String token) async {
    try {
      print("DeviceApiService: Getting devices with token: ${token.substring(0, 20)}...");
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.devicesEndpoint}"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
      );
      
      print("DeviceApiService: Request headers: {Content-Type: application/json, Authorization: Bearer ${token.substring(0, 20)}...}");

      print("DeviceApiService: Get devices response status: ${response.statusCode}");
      print("DeviceApiService: Get devices response body: ${response.body}");

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data["success"] == true) {
          final deviceList = data["data"]["devices"] as List<dynamic>? ?? [];
          final devices = deviceList.map((item) => Device.fromBackend(item)).toList();
          print("DeviceApiService: Loaded ${devices.length} devices: ${devices.map((d) => '${d.name} (${d.id})').join(', ')}");
          return devices;
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
  // Validate input parameters
      if (token.isEmpty) {
        print("DeviceApiService: Empty token provided");
        return false;
      }

      if (deviceId.isEmpty) {
        print("DeviceApiService: Empty device ID provided");
        return false;
      }

      if (device.name.isEmpty) {
        print("DeviceApiService: Empty device name provided");
        return false;
      }

      final requestBody = {
        "deviceName": device.name,
        "volume": device.volume,
        "eq": device.eqSettings.frequencies,
        "reverb": device.reverb,
      };
      
      print("DeviceApiService: Updating device $deviceId with body: ${jsonEncode(requestBody)}");
      
      final response = await http.put(
        Uri.parse("${ApiConfig.baseUrl}${ApiConfig.devicesEndpoint}/$deviceId"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode(requestBody),
      );

      print("DeviceApiService: Response status: ${response.statusCode}");
      print("DeviceApiService: Response body: ${response.body}");
      
      if (response.statusCode == 200) {
  // Attempt to parse the response to confirm success
        try {
          final responseData = jsonDecode(response.body);
          if (responseData is Map<String, dynamic> && responseData["success"] == true) {
            print("DeviceApiService: Device update confirmed by server");
            return true;
          } else {
            print("DeviceApiService: Server returned success=false or invalid response format");
          }
        } catch (e) {
          print("DeviceApiService: Could not parse response JSON, but status 200: $e");
          // Status code 200 but JSON parsing failed; return true conservatively
          return true;
        }
      }
      
      return false;
    } catch (e) {
      print("DeviceApiService: Exception during device update: $e");
      return false;
    }
  }
}
