import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../providers/device_provider.dart";
import "../providers/auth_provider.dart";
import "../models/models.dart";

class DeviceControlScreen extends StatefulWidget {
  const DeviceControlScreen({super.key});

  @override
  State<DeviceControlScreen> createState() => _DeviceControlScreenState();
}

class _DeviceControlScreenState extends State<DeviceControlScreen> {
  Future<void> _saveCurrentDeviceSettings(BuildContext context) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);
    
    final selectedDevice = deviceProvider.selectedDevice;
    if (selectedDevice == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("No device selected"),
          duration: Duration(seconds: 2),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
  // Validate required data
      if (authProvider.token == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Authentication token missing"),
              duration: Duration(seconds: 2),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      if (selectedDevice.name.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Device name is empty"),
              duration: Duration(seconds: 2),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }
      
      final success = await deviceProvider.updateDevice(authProvider.token!, selectedDevice);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? "Settings saved successfully" : "Failed to save settings"),
            duration: Duration(milliseconds: success ? 1500 : 2000),
            backgroundColor: success ? Colors.green : Colors.red,
          ),
        );
      }
    } catch (e) {
      print('Error in _saveCurrentDeviceSettings: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Failed to save: ${e.toString()}"),
            duration: const Duration(seconds: 3),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _refreshDeviceData(BuildContext context) async {
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);
    
    await deviceProvider.refreshDevices();
    
    if (mounted && deviceProvider.errorMessage.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(deviceProvider.errorMessage),
          duration: const Duration(seconds: 2),
          backgroundColor: Colors.red,
        ),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Device data refreshed"),
          duration: Duration(seconds: 1),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer2<DeviceProvider, AuthProvider>(
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text("Device Control", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    Row(
                      children: [
                        ElevatedButton.icon(
                          onPressed: () => _refreshDeviceData(context),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Refresh Data'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue,
                            foregroundColor: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          onPressed: deviceProvider.isLoading ? null : () => _saveCurrentDeviceSettings(context),
                          icon: const Icon(Icons.save),
                          label: const Text('Save Settings'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
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
                    final currentDevice = deviceProvider.selectedDevice;
                    if (currentDevice != null) {
                      deviceProvider.updateSelectedDeviceVolume(value);
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
                          final currentDevice = deviceProvider.selectedDevice;
                          if (currentDevice != null) {
                            final newFreqs = List<double>.from(currentDevice.eqSettings.frequencies);
                            newFreqs[index] = value;
                            deviceProvider.updateSelectedDeviceEQ(
                              EQSettings(frequencies: newFreqs)
                            );
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
                    final currentDevice = deviceProvider.selectedDevice;
                    if (currentDevice != null) {
                      deviceProvider.updateSelectedDeviceReverb(value);
                    }
                  },
                ),
              ],
            ),
          );
        },
      );
  }
}
