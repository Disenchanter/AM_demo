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
                  ElevatedButton(
                    onPressed: () => _showCreatePresetDialog(context),
                    child: const Text("Create Preset"),
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
                        subtitle: Text(preset.description),
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

  void _applyPreset(BuildContext context, Preset preset) async {
    final presetProvider = Provider.of<PresetProvider>(context, listen: false);
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    if (authProvider.token != null && deviceProvider.selectedDevice != null) {
      final success = await presetProvider.applyPreset(
        authProvider.token!,
        preset.id,
        deviceProvider.selectedDevice!.id,
      );

      if (success) {
        deviceProvider.updateSelectedDeviceEQ(preset.eqSettings);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Preset applied successfully")),
          );
        }
      } else if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Failed to apply preset")),
        );
      }
    }
  }

  void _showCreatePresetDialog(BuildContext context) {
    final nameController = TextEditingController();
    final descriptionController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Create New Preset"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: "Preset Name"),
              ),
              TextField(
                controller: descriptionController,
                decoration: const InputDecoration(labelText: "Description"),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () => _createPreset(context, nameController.text, descriptionController.text),
              child: const Text("Create"),
            ),
          ],
        );
      },
    );
  }

  void _createPreset(BuildContext context, String name, String description) async {
    if (name.isEmpty) return;

    final presetProvider = Provider.of<PresetProvider>(context, listen: false);
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    if (authProvider.token != null && deviceProvider.selectedDevice != null) {
      final preset = Preset(
        id: "",
        name: name,
        description: description,
        eqSettings: deviceProvider.selectedDevice!.eqSettings,
        createdBy: authProvider.currentUser?.id ?? "",
      );

      final success = await presetProvider.createPreset(authProvider.token!, preset);

      if (context.mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? "Preset created successfully" : "Failed to create preset"),
          ),
        );
      }
    }
  }
}
