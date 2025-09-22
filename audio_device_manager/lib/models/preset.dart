import "eq_settings.dart";

class Preset {
  final String id;
  final String name;
  final String description;
  final EQSettings eqSettings;
  final bool isDefault;
  final String createdBy;

  const Preset({
    required this.id,
    required this.name,
    required this.description,
    required this.eqSettings,
    this.isDefault = false,
    required this.createdBy,
  });

  factory Preset.fromBackend(Map<String, dynamic> backendData) {
    return Preset(
      id: backendData["presetId"] ?? "",
      name: backendData["presetName"] ?? "",
      description: backendData["description"] ?? "",
      eqSettings: backendData["eq"] != null
          ? EQSettings.fromBackend(backendData["eq"])
          : const EQSettings(frequencies: [0.0, 0.0, 0.0, 0.0, 0.0]),
      isDefault: backendData["isDefault"] ?? false,
      createdBy: backendData["createdBy"] ?? "",
    );
  }

  Preset copyWith({
    String? id,
    String? name,
    String? description,
    EQSettings? eqSettings,
    bool? isDefault,
    String? createdBy,
  }) {
    return Preset(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      eqSettings: eqSettings ?? this.eqSettings,
      isDefault: isDefault ?? this.isDefault,
      createdBy: createdBy ?? this.createdBy,
    );
  }
}
