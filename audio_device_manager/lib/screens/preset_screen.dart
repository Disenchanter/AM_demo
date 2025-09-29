import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../providers/preset_provider.dart";
import "../providers/device_provider.dart";
import "../providers/auth_provider.dart";
import "../models/models.dart";

class PresetScreen extends StatelessWidget {
  const PresetScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer3<PresetProvider, DeviceProvider, AuthProvider>(
      builder: (context, presetProvider, deviceProvider, authProvider, child) {
        if (presetProvider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        return Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Audio Presets", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  Row(
                    children: [
                      ElevatedButton.icon(
                        onPressed: presetProvider.isLoading ? null : () => _refreshPresets(context),
                        icon: const Icon(Icons.refresh),
                        label: const Text("Refresh"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue,
                          foregroundColor: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton.icon(
                        onPressed: () => _showCreatePresetDialog(context),
                        icon: const Icon(Icons.add),
                        label: const Text("Create Preset"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.builder(
                  itemCount: presetProvider.presets.length,
                  itemBuilder: (context, index) {
                    final preset = presetProvider.presets[index];
                    return Card(
                      child: ListTile(
                        title: Text(preset.name),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(preset.description),
                            const SizedBox(height: 4),
                            Text(
                              "Vol: ${(preset.volume * 100).toInt()}% | "
                              "Reverb: ${(preset.reverb * 100).toInt()}% | "
                              "EQ: ${preset.eqSettings.frequencies.map((f) => f.toStringAsFixed(1)).join(', ')}",
                              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                        ),
                        trailing: ElevatedButton(
                          onPressed: deviceProvider.selectedDevice != null
                              ? () => _applyPreset(context, preset)
                              : null,
                          child: const Text("Apply"),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _refreshPresets(BuildContext context) async {
    final presetProvider = Provider.of<PresetProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    if (authProvider.token != null) {
      await presetProvider.refreshPresets(authProvider.token!);
      
      if (context.mounted && presetProvider.errorMessage.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(presetProvider.errorMessage),
            duration: const Duration(seconds: 2),
            backgroundColor: Colors.red,
          ),
        );
      } else if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Preset list refreshed"),
            duration: Duration(seconds: 1),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  void _applyPreset(BuildContext context, Preset preset) async {
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);

    print("PresetScreen: Applying preset ${preset.name} (${preset.id}) to device ${deviceProvider.selectedDevice?.id}");

    if (deviceProvider.selectedDevice != null) {
  // Show feedback when applying a preset
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Applying preset..."),
            duration: Duration(seconds: 1),
          ),
        );
      }

  // Update the local device state directly without invoking the backend
      try {
        deviceProvider.updateSelectedDeviceVolume(preset.volume);
        deviceProvider.updateSelectedDeviceEQ(preset.eqSettings);
        deviceProvider.updateSelectedDeviceReverb(preset.reverb);
        
        print("PresetScreen: Successfully applied preset - Volume: ${preset.volume}, Reverb: ${preset.reverb}, EQ: ${preset.eqSettings.frequencies}");
        
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Preset “${preset.name}” applied locally. Tap Save Settings to persist."),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      } catch (e) {
        print("PresetScreen: Error applying preset: $e");
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Failed to apply preset. Please try again."),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Select a device first"),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  void _showCreatePresetDialog(BuildContext context) {
    final nameController = TextEditingController();
    final descriptionController = TextEditingController();
    bool isPublic = false;
    
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);
    final selectedDevice = deviceProvider.selectedDevice;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text("Create New Preset"),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: "Preset Name"),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: descriptionController,
                    decoration: const InputDecoration(labelText: "Description"),
                  ),
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    title: const Text("Public preset"),
                    subtitle: const Text("Other users can discover and use this preset"),
                    value: isPublic,
                    onChanged: (bool? value) {
                      setState(() {
                        isPublic = value ?? false;
                      });
                    },
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  const SizedBox(height: 8),
                  if (selectedDevice != null) ...[
                    const Text("Current Settings to Save:", 
                      style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text("Volume: ${(selectedDevice.volume * 100).toInt()}%"),
                    Text("Reverb: ${(selectedDevice.reverb * 100).toInt()}%"),
                    Text("EQ Bands: ${selectedDevice.eqSettings.frequencies.map((f) => f.toStringAsFixed(1)).join(', ')}"),
                  ] else
                    const Text("No device selected", style: TextStyle(color: Colors.red)),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text("Cancel"),
                ),
                ElevatedButton(
                  onPressed: () => _createPreset(context, nameController.text, descriptionController.text, isPublic),
                  child: const Text("Create"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _createPreset(BuildContext context, String name, String description, bool isPublic) async {
    if (name.isEmpty) return;

    final presetProvider = Provider.of<PresetProvider>(context, listen: false);
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    if (authProvider.token != null && deviceProvider.selectedDevice != null) {
      final selectedDevice = deviceProvider.selectedDevice!;
      final preset = Preset(
        id: "",
        name: name,
        description: description,
        volume: selectedDevice.volume,
        eqSettings: selectedDevice.eqSettings,
        reverb: selectedDevice.reverb,
        createdBy: authProvider.currentUser?.id ?? "",
        isPublic: isPublic,
      );

      final success = await presetProvider.createPreset(authProvider.token!, preset);

      if (context.mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? "Preset created successfully" : "Failed to create preset"),
            backgroundColor: success ? Colors.green : Colors.red,
          ),
        );
      }
    }
  }
}
