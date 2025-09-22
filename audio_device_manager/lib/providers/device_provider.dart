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
      _devices = await _deviceApiService.getDevices(token);
      if (_devices.isNotEmpty && _selectedDevice == null) {
        _selectedDevice = _devices.first;
      }
      
      // 不再自动启动定期刷新
      // _startPeriodicRefresh();
    } catch (e) {
      _errorMessage = "Failed to load devices: $e";
    }

    _setLoading(false);
  }

  // 手动刷新设备数据
  Future<void> refreshDevices() async {
    if (_currentToken == null) return;
    
    _setLoading(true);
    _errorMessage = "";

    try {
      final updatedDevices = await _deviceApiService.getDevices(_currentToken!);
      _devices = updatedDevices;
      
      // 如果选中的设备存在于更新后的列表中，更新它
      if (_selectedDevice != null) {
        final updatedSelected = updatedDevices.firstWhere(
          (device) => device.id == _selectedDevice!.id,
          orElse: () => _selectedDevice!,
        );
        _selectedDevice = updatedSelected;
      }
    } catch (e) {
      _errorMessage = "刷新设备数据失败: $e";
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
      // 验证输入参数
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

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}
