import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../providers/auth_provider.dart";
import "../providers/device_provider.dart";
import "../providers/preset_provider.dart";
import "device_control_screen.dart";
import "preset_screen.dart";

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  
  final List<Widget> _screens = [
    const DeviceControlScreen(),
    const PresetScreen(),
  ];

  @override
  void initState() {
    super.initState();
  // Delay initialization to avoid setState calls during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeData();
    });
  }

  Future<void> _initializeData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);
    final presetProvider = Provider.of<PresetProvider>(context, listen: false);
    
    if (authProvider.token != null) {
      await Future.wait([
        deviceProvider.loadDevices(authProvider.token!),
        presetProvider.loadPresets(authProvider.token!),
      ]);
    }
  }

  Future<void> _handleLogout() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.logout();
    if (mounted) {
      Navigator.pushReplacementNamed(context, "/login");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Audio Device Manager"),
        actions: [
          Consumer<AuthProvider>(
            builder: (context, authProvider, child) {
              final user = authProvider.currentUser;
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Display user information
                  if (user != null) 
                    Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            user.username,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            "Signed in",
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ),
                  // Logout button
                  IconButton(
                    icon: const Icon(Icons.logout),
                    tooltip: "Sign out",
                    onPressed: _handleLogout,
                  ),
                ],
              );
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.devices),
            label: "Devices",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.tune),
            label: "Presets",
          ),
        ],
      ),
    );
  }
}
