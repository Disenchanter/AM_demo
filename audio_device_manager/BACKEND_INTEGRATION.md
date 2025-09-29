# Flutter Frontend and AWS Backend Integration Guide

## Overview

This Flutter app now connects to the AWS backend APIs. It supports user authentication, device management, and preset management.

## Configuration Steps

### 1. Configure API Endpoints

Update `lib/config/api_config.dart` and replace `baseUrl` with the actual API Gateway URL:

```dart
class ApiConfig {
  // Replace with your API Gateway URL
  static const String baseUrl = 'https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/dev';
  // ... additional configuration
}
```

### 2. Retrieve the API Gateway URL

Grab the deployed API Gateway URL from the AWS Console or the CloudFormation stack output. The format generally looks like:
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
```

### 3. Test the Connection

1. Launch the Flutter application.
2. Navigate to the "API Tests" screen.
3. Tap the various test buttons to validate connectivity.

## API Endpoint Mapping

| Feature | HTTP Method | Endpoint | Description |
|---------|-------------|----------|-------------|
| User login | POST | `/api/auth/login` | Authenticate a user |
| User registration | POST | `/api/auth/register` | Register a new user |
| User profile | GET | `/api/auth/profile` | Fetch profile details |
| List devices | GET | `/api/devices` | Retrieve device list |
| Update device | PUT | `/api/devices/{id}` | Update device state |
| List presets | GET | `/api/presets` | Retrieve preset list |
| Create preset | POST | `/api/devices/{id}/presets` | Create a preset |
| Apply preset | POST | `/api/devices/{id}/apply-preset` | Apply preset to a device |

## Data Models

### Device
- `device_id`: Unique identifier for the device
- `device_name`: Human-readable name
- `state.volume`: Volume (0.0-1.0)
- `state.eq`: Five-band EQ array
- `state.reverb`: Reverb value (0.0-1.0)
- `is_online`: Online/offline status
- `last_seen`: Last contact timestamp

### Preset
- `preset_id`: Unique preset identifier
- `preset_name`: Preset name
- `audio_profile`: Audio profile payload
- `is_public`: Whether the preset is public
- `created_by`: ID of the creator

### User
- `user_id`: Unique user identifier
- `username`: Display name
- `email`: Email address

## Error Handling

The app includes comprehensive error handling:

1. **Network errors**: Notifies users of connectivity issues.
2. **Authentication errors**: Surfaces login failures or expired tokens.
3. **API errors**: Displays error details returned by the API.
4. **Data format errors**: Guards against malformed responses.

## Development and Debugging

### Enable Debug Logging

Add request logging in `api_client.dart`:

```dart
print('Request URL: $url');
print('Request headers: $requestHeaders');
print('Request body: ${body != null ? jsonEncode(body) : 'null'}');
print('Response status: ${response.statusCode}');
print('Response body: ${response.body}');
```

### Local Testing

To target a locally running backend, set:

```dart
static const String baseUrl = 'http://localhost:3000'; // Local development server
```

Note: The iOS simulator may need additional configuration to reach localhost.

## Security Considerations

1. **Token storage**: Authentication tokens are stored securely with SharedPreferences.
2. **HTTPS**: Production environments must use HTTPS endpoints.
3. **Input validation**: The client applies basic validation before sending requests.
4. **Error messaging**: Avoid leaking sensitive system details.

## Troubleshooting

### Common Issues

1. **Connection timeout**: Check network connectivity and API Gateway health.
2. **Authentication failure**: Confirm user credentials and Cognito configuration.
3. **CORS errors**: Ensure API Gateway has proper CORS settings.
4. **Data format mismatch**: Validate that frontend and backend models align.

### Log Inspection

Inspect the Flutter console logs and AWS CloudWatch logs to diagnose issues.

## Next Steps

1. Add a registration flow in the UI.
2. Implement real-time device status updates.
3. Introduce additional audio effect parameters.
4. Support offline usage.
5. Provide device grouping capabilities.