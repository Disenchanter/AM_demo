import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../providers/device_provider.dart";
import "../providers/auth_provider.dart";
import "../models/models.dart";

class DeviceControlScreen extends StatelessWidget {
  const DeviceControlScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Device Control')),
      body: Consumer2<DeviceProvider, AuthProvider>(
        builder: (context, deviceProvider, authProvider, child) {
          if (deviceProvider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (deviceProvider.devices.isEmpty) {
            return const Center(child: Text("No devices found"));
          }

          final selectedDevice = deviceProvider.selectedDevice;
          if (selectedDevice == null) {
            return const Center(child: Text("No device selected"));
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButton<Device>(
                  value: selectedDevice,
                  isExpanded: true,
                  items: deviceProvider.devices.map((device) {
                    return DropdownMenuItem(
                      value: device,
                      child: Text(device.name),
                    );
                  }).toList(),
                  onChanged: (device) {
                    if (device != null) {
                      deviceProvider.selectDevice(device);
                    }
                  },
                ),
                const SizedBox(height: 20),
                Text("Volume: ${(selectedDevice.volume * 100).toInt()}%"),
                Slider(
                  value: selectedDevice.volume,
                  onChanged: (value) {
                    deviceProvider.updateSelectedDeviceVolume(value);
                  },
                  onChangeEnd: (value) {
                    final token = authProvider.token;
                    if (token != null) {
                      deviceProvider.updateDevice(token, selectedDevice.copyWith(volume: value));
                    }
                  },
                ),
                const SizedBox(height: 20),
                const Text("EQ Settings"),
                ...List.generate(5, (index) {
                  return Column(
                    children: [
                      Text("Band ${index + 1}: ${selectedDevice.eqSettings.frequencies[index].toStringAsFixed(1)}"),
                      Slider(
                        value: selectedDevice.eqSettings.frequencies[index],
                        min: -10.0,
                        max: 10.0,
                        divisions: 200,
                        onChanged: (value) {
                          final newFreqs = List<double>.from(selectedDevice.eqSettings.frequencies);
                          newFreqs[index] = value;
                          deviceProvider.updateSelectedDeviceEQ(
                            EQSettings(frequencies: newFreqs)
                          );
                        },
                        onChangeEnd: (value) {
                          final token = authProvider.token;
                          if (token != null) {
                            final newFreqs = List<double>.from(selectedDevice.eqSettings.frequencies);
                            newFreqs[index] = value;
                            final newEQ = EQSettings(frequencies: newFreqs);
                            deviceProvider.updateDevice(token, selectedDevice.copyWith(eqSettings: newEQ));
                          }
                        },
                      ),
                    ],
                  );
                }),
                const SizedBox(height: 20),
                Text("Reverb: ${(selectedDevice.reverb * 100).toInt()}%"),
                Slider(
                  value: selectedDevice.reverb,
                  onChanged: (value) {
                    deviceProvider.updateSelectedDeviceReverb(value);
                  },
                  onChangeEnd: (value) {
                    final token = authProvider.token;
                    if (token != null) {
                      deviceProvider.updateDevice(token, selectedDevice.copyWith(reverb: value));
                    }
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
