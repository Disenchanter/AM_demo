import "eq_settings.dart";

class Device {
  final String id;
  final String name;
  final double volume;
  final EQSettings eqSettings;
  final double reverb;
  final bool isOnline;

  const Device({
    required this.id,
    required this.name,
    this.volume = 0.5,
    required this.eqSettings,
    this.reverb = 0.0,
    this.isOnline = false,
  });

  factory Device.fromBackend(Map<String, dynamic> backendData) {
    final state = backendData["state"] as Map<String, dynamic>? ?? {};
    
    return Device(
      id: backendData["deviceId"] ?? "",
      name: backendData["deviceName"] ?? "",
      volume: (state["volume"] as num?)?.toDouble() ?? 0.5,
      eqSettings: state["eq"] != null
          ? EQSettings.fromBackend(state["eq"])
          : const EQSettings(frequencies: [0.0, 0.0, 0.0, 0.0, 0.0]),
      reverb: (state["reverb"] as num?)?.toDouble() ?? 0.0,
      isOnline: backendData["isOnline"] ?? false,
    );
  }

  Device copyWith({
    String? id,
    String? name,
    double? volume,
    EQSettings? eqSettings,
    double? reverb,
    bool? isOnline,
  }) {
    return Device(
      id: id ?? this.id,
      name: name ?? this.name,
      volume: volume ?? this.volume,
      eqSettings: eqSettings ?? this.eqSettings,
      reverb: reverb ?? this.reverb,
      isOnline: isOnline ?? this.isOnline,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Device && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
