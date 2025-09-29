import "package:flutter/material.dart";
import "dart:async";
import "../services/device_api_service.dart";
import "../models/models.dart";

class DeviceProvider with ChangeNotifier {
  List<Device> _devices = [];
  Device? _selectedDevice;
  bool _isLoading = false;
  String _errorMessage = "";
  Timer? _refreshTimer;
  String? _currentToken;

  final DeviceApiService _deviceApiService = DeviceApiService();

  List<Device> get devices => _devices;
  Device? get selectedDevice => _selectedDevice;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;

  Future<void> loadDevices(String token) async {
    _setLoading(true);
    _errorMessage = "";
    _currentToken = token;

    try {
      final fetchedDevices = await _deviceApiService.getDevices(token);
      _devices = _deduplicateDevices(fetchedDevices);
      if (_devices.isNotEmpty && _selectedDevice == null) {
        _selectedDevice = _devices.first;
      }
      if (_selectedDevice != null) {
        _selectedDevice = _findDeviceById(_selectedDevice!.id);
      }
      
  // No longer start periodic refresh automatically
  // _startPeriodicRefresh();
    } catch (e) {
      _errorMessage = "Failed to load devices: $e";
    }

    _setLoading(false);
  }

  // Manually trigger a refresh of device data
  Future<void> refreshDevices() async {
    if (_currentToken == null) return;
    
    _setLoading(true);
    _errorMessage = "";

    try {
      final updatedDevices = await _deviceApiService.getDevices(_currentToken!);
      _devices = _deduplicateDevices(updatedDevices);

      if (_selectedDevice != null) {
        final matched = _findDeviceById(_selectedDevice!.id);
        if (matched != null) {
          _selectedDevice = matched;
        } else if (_devices.isNotEmpty) {
          _selectedDevice = _devices.first;
        } else {
          _selectedDevice = null;
        }
      } else if (_devices.isNotEmpty) {
        _selectedDevice = _devices.first;
      }
    } catch (e) {
  _errorMessage = "Failed to refresh devices: $e";
    }

    _setLoading(false);
  }

  void selectDevice(Device device) {
    _selectedDevice = device;
    notifyListeners();
  }

  Future<bool> updateDevice(String token, Device device) async {
    _setLoading(true);
    _errorMessage = "";

    try {
  // Validate incoming parameters
      if (token.isEmpty) {
        _errorMessage = "Invalid token";
        print("DeviceProvider: Empty token provided");
        _setLoading(false);
        return false;
      }

      if (device.id.isEmpty || device.name.isEmpty) {
        _errorMessage = "Invalid device data";
        print("DeviceProvider: Invalid device data - ID: ${device.id}, Name: ${device.name}");
        _setLoading(false);
        return false;
      }

      print("DeviceProvider: Updating device ${device.id} with volume: ${device.volume}, reverb: ${device.reverb}");
      final success = await _deviceApiService.updateDevice(token, device.id, device);
      
      if (success) {
        print("DeviceProvider: Device update successful, updating local state");
        final index = _devices.indexWhere((d) => d.id == device.id);
        if (index != -1) {
          _devices[index] = device;
          if (_selectedDevice?.id == device.id) {
            _selectedDevice = device;
          }
        }
      } else {
        _errorMessage = "Failed to update device";
        print("DeviceProvider: Device update failed");
      }

      _setLoading(false);
      return success;
    } catch (e) {
      _errorMessage = "Error updating device: ${e.toString()}";
      print("DeviceProvider: Exception during device update: $e");
      _setLoading(false);
      return false;
    }
  }

  void updateSelectedDeviceVolume(double volume) {
    if (_selectedDevice != null) {
      _selectedDevice = _selectedDevice!.copyWith(volume: volume);
      notifyListeners();
    }
  }

  void updateSelectedDeviceEQ(EQSettings eqSettings) {
    if (_selectedDevice != null) {
      _selectedDevice = _selectedDevice!.copyWith(eqSettings: eqSettings);
      notifyListeners();
    }
  }

  void updateSelectedDeviceReverb(double reverb) {
    if (_selectedDevice != null) {
      _selectedDevice = _selectedDevice!.copyWith(reverb: reverb);
      notifyListeners();
    }
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  List<Device> _deduplicateDevices(List<Device> devices) {
    final uniqueDevices = <String, Device>{};
    for (final device in devices) {
      if (device.id.isNotEmpty) {
        uniqueDevices[device.id] = device;
      }
    }
    return uniqueDevices.values.toList();
  }

  Device? _findDeviceById(String id) {
    for (final device in _devices) {
      if (device.id == id) {
        return device;
      }
    }
    return null;
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}
