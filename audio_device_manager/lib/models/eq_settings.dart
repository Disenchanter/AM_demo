class EQSettings {
  final List<double> frequencies;

  const EQSettings({required this.frequencies});

  factory EQSettings.fromBackend(dynamic backendEq) {
    if (backendEq is List) {
      return EQSettings(
        frequencies: List<double>.from(
          backendEq.map((e) => (e as num?)?.toDouble() ?? 0.0)
        ),
      );
    }
    return const EQSettings(frequencies: [0.0, 0.0, 0.0, 0.0, 0.0]);
  }

  Map<String, dynamic> toJson() {
    return {"frequencies": frequencies};
  }

  EQSettings copyWith({List<double>? frequencies}) {
    return EQSettings(frequencies: frequencies ?? this.frequencies);
  }
}
