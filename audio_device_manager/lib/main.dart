import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "providers/auth_provider.dart";
import "providers/device_provider.dart";
import "providers/preset_provider.dart";
import "screens/login_screen.dart";
import "screens/home_screen.dart";

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AudioDeviceManagerApp());
}

class AudioDeviceManagerApp extends StatelessWidget {
  const AudioDeviceManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => DeviceProvider()),
        ChangeNotifierProvider(create: (_) => PresetProvider()),
      ],
      child: MaterialApp(
        title: "Audio Device Manager",
        theme: ThemeData(
          primarySwatch: Colors.blue,
          useMaterial3: true,
        ),
        initialRoute: "/",
        routes: {
          "/": (context) => const SplashScreen(),
          "/login": (context) => const LoginScreen(),
          "/home": (context) => const HomeScreen(),
        },
      ),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.initialize();

    if (mounted) {
      if (authProvider.isLoggedIn) {
        Navigator.pushReplacementNamed(context, "/home");
      } else {
        Navigator.pushReplacementNamed(context, "/login");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
