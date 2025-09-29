import "package:flutter/material.dart";
import "../services/preset_api_service.dart";
import "../models/models.dart";

class PresetProvider with ChangeNotifier {
  List<Preset> _presets = [];
  bool _isLoading = false;
  String _errorMessage = "";

  final PresetApiService _presetApiService = PresetApiService();

  List<Preset> get presets => _presets;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;

  Future<void> loadPresets(String token) async {
    _setLoading(true);
    _errorMessage = "";

    try {
      _presets = await _presetApiService.getPresets(token);
    } catch (e) {
      _errorMessage = "Failed to load presets: $e";
    }

    _setLoading(false);
  }

  Future<bool> createPreset(String token, Preset preset) async {
    _setLoading(true);
    _errorMessage = "";

    final success = await _presetApiService.createPreset(token, preset);
    
    if (!success) {
      _errorMessage = "Failed to create preset";
    }

    _setLoading(false);
    return success;
  }

  Future<bool> applyPreset(String token, String presetId, String deviceId) async {
    _setLoading(true);
    _errorMessage = "";

    final success = await _presetApiService.applyPreset(token, presetId, deviceId);
    
    if (!success) {
      _errorMessage = "Failed to apply preset";
    }

    _setLoading(false);
    return success;
  }

  Future<void> refreshPresets(String token) async {
    _setLoading(true);
    _errorMessage = "";

    try {
      _presets = await _presetApiService.getPresets(token);
    } catch (e) {
      _errorMessage = "Failed to refresh presets: $e";
    }

    _setLoading(false);
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }
}
