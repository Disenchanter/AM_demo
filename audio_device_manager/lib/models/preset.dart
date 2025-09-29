import "eq_settings.dart";

class Preset {
  final String id;
  final String name;
  final String description;
  final double volume;
  final EQSettings eqSettings;
  final double reverb;
  final bool isDefault;
  final String createdBy;
  final bool isPublic;

  const Preset({
    required this.id,
    required this.name,
    required this.description,
    this.volume = 0.5,
    required this.eqSettings,
    this.reverb = 0.0,
    this.isDefault = false,
    required this.createdBy,
    this.isPublic = false,
  });

  factory Preset.fromBackend(Map<String, dynamic> backendData) {
  // Handle nested profile structure returned by the backend
    final profile = backendData["profile"] as Map<String, dynamic>?;
    
    return Preset(
      id: backendData["id"] ?? backendData["presetId"] ?? "",
      name: backendData["name"] ?? backendData["presetName"] ?? "",
      description: backendData["description"] ?? "",
      volume: (profile?["volume"] as num?)?.toDouble() ?? 
              (backendData["volume"] as num?)?.toDouble() ?? 0.5,
      eqSettings: profile?["eq"] != null
          ? EQSettings.fromBackend(profile!["eq"])
          : (backendData["eq"] != null
              ? EQSettings.fromBackend(backendData["eq"])
              : const EQSettings(frequencies: [0.0, 0.0, 0.0, 0.0, 0.0])),
      reverb: (profile?["reverb"] as num?)?.toDouble() ?? 
              (backendData["reverb"] as num?)?.toDouble() ?? 0.0,
      isDefault: backendData["isDefault"] ?? false,
      createdBy: backendData["createdBy"] ?? "",
      isPublic: backendData["isPublic"] ?? backendData["is_public"] ?? false,
    );
  }

  Preset copyWith({
    String? id,
    String? name,
    String? description,
    double? volume,
    EQSettings? eqSettings,
    double? reverb,
    bool? isDefault,
    String? createdBy,
    bool? isPublic,
  }) {
    return Preset(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      volume: volume ?? this.volume,
      eqSettings: eqSettings ?? this.eqSettings,
      reverb: reverb ?? this.reverb,
      isDefault: isDefault ?? this.isDefault,
      createdBy: createdBy ?? this.createdBy,
      isPublic: isPublic ?? this.isPublic,
    );
  }
}
