# Audio Device Manager

A Flutter-based demo application for managing audio devices. It supports user authentication, device control, and preset management capabilities.

## Feature Highlights

### 🔐 User Authentication
- **Sign-in/Sign-up**: Supports username/password login and new account registration.
- **Role Management**: Distinguishes permissions between standard users and administrators.
- **Session Handling**: Relies on SharedPreferences for local session persistence.

### 🎧 Device Management
- **Device List**: Horizontally scrollable list of all registered audio devices.
- **Connection Status**: Real-time online/offline indicators for each device.
- **Volume Control**: Slider-based volume adjustment with quick access buttons.
- **EQ Equalizer**: Ten-band equalizer with live preview updates.
- **Device Details**: Displays device model, last updated time, and other metadata.

### 🎛️ Preset Management
- **Built-in Presets**: Includes Flat, Rock, Pop, Jazz, and more.
- **Custom Presets**: Administrators can create and manage bespoke presets.
- **One-click Apply**: Apply any preset to the active device instantly.
- **Search Experience**: Search by name, description, or keyword tags.
- **Tag Filtering**: Multi-tag filter controls for faster discovery.

### 👨‍💼 Administrator Tools
- **Save Presets**: Persist current device settings as public or private presets.
- **Preset Administration**: Edit or delete user-created presets.
- **User Governance**: Visual admin badge and privilege enforcement.

## Architecture

### 📁 Project Structure
```
lib/
├── main.dart                    # Application entry point
├── models/                      # Data models
│   ├── user.dart                # User model
│   ├── device.dart              # Device model
│   ├── preset.dart              # Preset model
│   └── models.dart              # Barrel export file
├── services/                    # Business logic services
│   ├── auth_service.dart        # Authentication integration
│   ├── device_service.dart      # Device-related API wrapper
│   └── preset_service.dart      # Preset-related API wrapper
├── providers/                   # State management
│   ├── auth_provider.dart       # Authentication state
│   ├── device_provider.dart     # Device state
│   └── preset_provider.dart     # Preset state
├── screens/                     # UI pages
│   ├── login_screen.dart        # Sign-in screen
│   ├── home_screen.dart         # Home dashboard
│   ├── device_control_screen.dart # Device control screen
│   └── preset_screen.dart       # Preset management screen
└── widgets/                     # Reusable components
   ├── volume_slider.dart       # Volume slider component
   ├── eq_slider.dart           # Equalizer slider component
   └── preset_selector.dart     # Preset selector component
```

### 🏗️ Tech Stack
- **Flutter**: Cross-platform UI framework
- **Provider**: State management solution
- **SharedPreferences**: Local persistence layer
- **Material Design**: Core design system

### 📊 Data Models
- **User**: Account information and role metadata
- **Device**: Device attributes, volume, and EQ profile
- **Preset**: Audio preset configuration and metadata
- **EQSettings**: Ten-band equalizer configuration

## Getting Started

### 📋 System Requirements
- Flutter SDK 3.9.2+
- Dart 3.9.2+
- Windows, macOS, or Linux development environment

### 🚀 Installation & Run
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd audio_device_manager
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Launch the application**
   ```bash
   # Windows
   flutter run -d windows

   # macOS
   flutter run -d macos

   # Linux
   flutter run -d linux

   # Mobile
   flutter run -d android
   flutter run -d ios
   ```

### 👥 Demo Accounts
| Role | Username | Password | Permissions |
|------|----------|----------|-------------|
| Administrator | admin | admin123 | Save/delete presets, manage users |
| Standard User | user1 | user123 | Control devices and apply presets |
| Standard User | user2 | user123 | Control devices and apply presets |

## UI Overview

### 🔑 Login Screen
- Clean login form layout
- Optional sign-up flow for new users
- Demo account hints for quick testing
- Input validation with contextual error prompts

### 🏠 Home Screen
- Bottom navigation bar for feature switching
- Header with user information and role badge
- Refresh action and sign-out button

### 🎵 Device Control Screen
- Horizontal carousel of registered devices
- Volume slider with quick preset buttons
- Ten-band EQ visualization
- Preset selector and apply controls
- Administrator-only save preset action

### ⚙️ Preset Management Screen
- Search box and tag filters
- Separate sections for system and user presets
- Modal dialog for preset details
- Admin-only edit and delete options

## Feature Walkthrough

### 🎚️ Volume Control
- Real-time slider adjustment
- Visual volume icon with dynamic color states
- Quick buttons for mute, low, medium, and high levels
- Numeric percentage indicator

### 🎛️ Equalizer
- Ten frequency bands (32 Hz–16 kHz)
- Live EQ curve visualization
- Quick switching between preset EQ modes
- Save custom equalizer configurations

### 💾 Preset System
- Built-in presets (Flat, Rock, Pop, Jazz, etc.)
- Create and manage personalized presets
- Categorize and search by preset tags
- Public versus private preset access control

## Data Persistence

The application relies on SharedPreferences for lightweight storage:
- Authentication tokens and session metadata
- Persisted device settings and last-known state
- User-defined presets
- Application preferences and configuration flags

## State Management

Provider is used to coordinate app-wide state:
- **AuthProvider**: Tracks user authentication and authority.
- **DeviceProvider**: Manages device list, selection, and edits.
- **PresetProvider**: Handles preset catalog and operations.

## Development Notes

### 🔧 Adding a New Device Type
1. Extend the `Device` model with the new type information.
2. Update the icon mapping within `DeviceService`.
3. Provide matching UI assets and styling.

### 📝 Extending Preset Features
1. Add new preset attributes to the `Preset` model.
2. Update persistence logic inside `PresetService`.
3. Adjust presets UI components to surface the new fields.

### 🎨 Customizing the Theme
1. Modify the `ThemeData` configuration in `main.dart`.
2. Refresh the color palette and component styles.
3. Align platform-specific design nuances.

## Roadmap

### 🔮 Planned Features
- [ ] Automatic discovery and pairing of Bluetooth devices
- [ ] Real-time audio effect preview
- [ ] Multi-device synchronization
- [ ] Cloud-based preset syncing
- [ ] Voice control integrations
- [ ] Audio analytics and visualization
- [ ] Personalized recommendation engine

### 🛠️ Technical Enhancements
- [ ] Evaluate Riverpod as a replacement for Provider
- [ ] Integrate an audio-processing library
- [ ] Add unit and integration test coverage
- [ ] Set up CI/CD automation
- [ ] Performance and memory optimizations
- [ ] Accessibility improvements

## License

This project is provided for demonstration and learning purposes only; commercial use is not permitted.

---

*Last updated: September 2024*
