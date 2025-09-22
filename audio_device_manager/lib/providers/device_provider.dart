import "package:flutter/material.dart";
import "../services/device_api_service.dart";
import "../models/models.dart";

class DeviceProvider with ChangeNotifier {
  List<Device> _devices = [];
  Device? _selectedDevice;
  bool _isLoading = false;
  String _errorMessage = "";

  final DeviceApiService _deviceApiService = DeviceApiService();

  List<Device> get devices => _devices;
  Device? get selectedDevice => _selectedDevice;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;

  Future<void> loadDevices(String token) async {
    _setLoading(true);
    _errorMessage = "";

    try {
      _devices = await _deviceApiService.getDevices(token);
      if (_devices.isNotEmpty && _selectedDevice == null) {
        _selectedDevice = _devices.first;
      }
    } catch (e) {
      _errorMessage = "Failed to load devices: $e";
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

    final success = await _deviceApiService.updateDevice(token, device.id, device);
    
    if (success) {
      final index = _devices.indexWhere((d) => d.id == device.id);
      if (index != -1) {
        _devices[index] = device;
        if (_selectedDevice?.id == device.id) {
          _selectedDevice = device;
        }
      }
    } else {
      _errorMessage = "Failed to update device";
    }

    _setLoading(false);
    return success;
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
}
