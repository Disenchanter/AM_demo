# Audio Device Management System API Documentation

## 📋 Table of Contents
- [API Overview](#api-overview)
- [Authentication](#authentication)
- [User Authentication Endpoints](#user-authentication-endpoints)
- [Device Management Endpoints](#device-management-endpoints)
- [Audio Preset Endpoints](#audio-preset-endpoints)
- [User Profile Endpoints](#user-profile-endpoints)
- [Data Models](#data-models)
- [Error Codes](#error-codes)

---

## API Overview

### Core Information
- **Base URL**: `https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api`
- **Protocol**: HTTPS
- **Data format**: JSON
- **Authentication**: JWT Bearer token (AWS Cognito)

### Authorization Model
- **Administrator (admin)**: Full read access to all resources and can create public presets
- **Standard User (user)**: Limited to personal resources, can create private presets, and can view public presets

---

## Authentication

### Authorization Header Format
```
Authorization: Bearer <JWT_TOKEN>
```

### Obtaining Tokens
Call `/api/auth/login` to receive a JWT token.

### Endpoints Without Authentication
All endpoints require a valid JWT unless explicitly noted below:
- `POST /api/auth/login` – Sign in
- `POST /api/auth/register` – Register

---

## User Authentication Endpoints

### Sign In
```http
POST /api/auth/login
```

**Request Body**:
```json
{
  "email": "admin@demo.com",
  "password": "AdminPass123!"
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "userId": "efb542c2-569b-45d1-80f0-0b5a85d340ff",
      "email": "admin@demo.com",
      "username": "admin",
  "fullName": "System Administrator",
      "role": "admin",
      "emailVerified": true,
      "status": "active"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJSUzI1NiIs...",
      "tokenType": "Bearer",
      "expiresIn": 3600
    },
    "sessionInfo": {
      "loginTime": "2025-09-23T10:30:15.123Z",
      "sessionId": "sess_abc123"
    }
  }
}
```

**Error 401**:
```json
{
  "error": "Login failed",
  "message": "Incorrect email or password"
}
```

### Register
```http
POST /api/auth/register
```

**Request Body**:
```json
{
  "email": "newuser@demo.com",
  "password": "UserPass123!",
  "fullName": "New User",
  "username": "newuser"
}
```

**Response 201**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "new-user-id-123",
    "email": "newuser@demo.com",
    "status": "pending_verification"
  }
}
```

---

## Device Management Endpoints

### List Devices
```http
GET /api/devices
Authorization: Bearer <token>
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
  "deviceName": "My Audio Device",
  "deviceModel": "Demo Audio Device v2.0",
        "ownerId": "user-id-123",
        "isOnline": true,
        "lastSeen": "2025-09-23T10:30:15.123Z",
        "state": {
          "volume": 0.75,
          "eq": [0, 2, -1, 3, 0],
          "reverb": 0.3,
          "lastPresetId": "preset-123",
          "syncVersion": 2
        },
        "createdAt": "2025-09-21T10:56:18.553Z",
        "updatedAt": "2025-09-23T10:30:15.123Z"
      }
    ],
    "count": 1,
    "userRole": "user"
  }
}
```

### Update Device State
```http
PUT /api/devices/{device_id}
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "volume": 0.8,
  "eq": [0, 2, -1, 3, 0],
  "reverb": 0.4
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Device state updated successfully",
  "data": {
    "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
    "state": {
      "volume": 0.8,
      "eq": [0, 2, -1, 3, 0],
      "reverb": 0.4,
      "syncVersion": 3,
      "updatedAt": "2025-09-23T10:30:15.123Z"
    }
  }
}
```

---

## Audio Preset Endpoints

### List Presets
```http
GET /api/presets
Authorization: Bearer <token>
```
or
```http
GET /api/devices/{device_id}/presets
Authorization: Bearer <token>
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
    "presets": [
      {
        "presetId": "542379c8-5563-42a7-9d10-566269053a27",
  "presetName": "Classical Music",
  "category": "music",
  "description": "Preset tuned for classical music",
        "isPublic": false,
        "createdBy": "user-id-123",
        "creatorRole": "user",
        "usageCount": 15,
        "profile": {
          "volume": 0.65,
          "eq": [0, -2, 1, 2, -1],
          "reverb": 0.7
        },
        "createdAt": "2025-09-21T10:56:15.284Z",
        "updatedAt": "2025-09-21T10:56:15.284Z"
      }
    ],
    "count": 1,
    "userRole": "user"
  }
}
```

### Create Preset
```http
POST /api/presets
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "presetName": "My Custom Preset",
  "category": "custom",
  "description": "Personalized audio preset",
  "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
  "isPublic": false,
  "profile": {
    "volume": 0.7,
    "eq": [2, 0, -1, 3, 1],
    "reverb": 0.5
  }
}
```

**Response 201**:
```json
{
  "success": true,
  "message": "Preset created successfully",
  "data": {
  "presetId": "new-preset-id-456",
  "presetName": "My Custom Preset",
    "category": "custom",
    "isPublic": false,
    "createdBy": "user-id-123",
    "createdAt": "2025-09-23T10:30:15.123Z"
  }
}
```

### Apply Preset to Device
```http
POST /api/devices/{device_id}/apply-preset
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "presetId": "542379c8-5563-42a7-9d10-566269053a27"
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Preset applied successfully",
  "data": {
    "deviceId": "937c612c-dabe-4b3f-8db4-64e4339f9d8f",
    "presetId": "542379c8-5563-42a7-9d10-566269053a27",
    "appliedState": {
      "volume": 0.65,
      "eq": [0, -2, 1, 2, -1],
      "reverb": 0.7,
      "lastPresetId": "542379c8-5563-42a7-9d10-566269053a27",
      "syncVersion": 4
    }
  }
}
```

---

## User Profile Endpoints

### Get Current User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```
or
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "efb542c2-569b-45d1-80f0-0b5a85d340ff",
      "email": "admin@demo.com",
  "username": "admin",
  "fullName": "System Administrator",
      "role": "admin",
      "avatarUrl": null,
      "emailVerified": true,
      "status": "active",
      "preferences": {
        "theme": "dark",
  "language": "en-US",
        "notifications": {
          "email": true,
          "push": true,
          "sound": true
        },
        "audio": {
          "defaultVolume": 0.7,
          "autoEq": true,
          "preferredQuality": "high"
        }
      },
      "profile": {
        "bio": "",
        "location": "",
        "website": "",
        "socialLinks": {
          "twitter": "",
          "github": "",
          "linkedin": ""
        }
      },
      "stats": {
        "devicesCount": 2,
        "presetsCount": 6,
        "lastLogin": "2025-09-23T10:30:15.123Z",
        "loginCount": 15,
        "totalSessionTime": 7200
      },
      "createdAt": "2025-09-21T10:56:11.318Z",
      "updatedAt": "2025-09-23T10:30:15.123Z",
      "lastActiveAt": "2025-09-23T10:30:15.123Z"
    }
  }
}
```

### Get Specific User Profile
```http
GET /api/users/{user_id}
Authorization: Bearer <token>
```

**Response 200** (administrators only):
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user-id-123",
      "username": "alice",
      "fullName": "Alice Johnson",
      "role": "user",
      "status": "active",
      "publicProfile": {
  "bio": "Music enthusiast",
  "location": "Beijing",
        "joinDate": "2025-09-21T10:56:14.382Z"
      },
      "stats": {
        "devicesCount": 1,
        "publicPresetsCount": 0
      }
    }
  }
}
```

---

## Data Models

### Audio Profile (AudioProfile)
```json
{
  "volume": 0.75,        // Volume (0.0-1.0)
  "eq": [0, 2, -1, 3, 0], // Five-band EQ (-12 to +12 dB)
  "reverb": 0.3,         // Reverb (0.0-1.0)
  "lastPresetId": "preset-123", // Most recently applied preset ID
  "syncVersion": 2,      // Synchronization version
  "updatedAt": "2025-09-23T10:30:15.123Z"
}
```

### Preset Categories
- `music` - Music
- `gaming` - Gaming
- `movie` - Movies
- `voice` - Voice presets
- `custom` - Custom user-defined

### User Roles
- `admin` - Administrator
- `user` - Standard user

### Account Status Values
- `active` - Active
- `inactive` - Inactive
- `suspended` - Suspended

---

## Error Codes

### HTTP Status Codes

| Status | Description | Details |
|--------|-------------|---------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication failed or token invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Unexpected server error |

### Error Response Structure
```json
{
  "error": "Error type",
  "message": "Detailed explanation",
  "details": "Technical details (optional)",
  "code": "ERROR_CODE (optional)"
}
```

### Common Errors

#### Authentication Failure
```json
{
  "error": "Login failed",
  "message": "Incorrect email or password"
}
```

#### Authorization Error
```json
{
  "error": "Forbidden",
  "message": "Only administrators can create public presets"
}
```

#### Resource Not Found
```json
{
  "error": "Not Found",
  "message": "The requested device does not exist"
}
```

#### Validation Error
```json
{
  "error": "Validation failed",
  "message": "Volume must be between 0 and 1",
  "details": "volume: 1.5 is not valid"
}
```

---

## Demo Accounts

Use the following credentials for testing:

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| **Administrator** | admin@demo.com | AdminPass123! | Access to all resources, can create public presets |
| **User** | alice@demo.com | UserPass123! | Access to personal resources, can create private presets |
| **User** | bob@demo.com | UserPass123! | Access to personal resources, can create private presets |
| **User** | carol@demo.com | UserPass123! | Access to personal resources, can create private presets |

---

## Usage Examples

### End-to-End Workflow

1. **User Login**
```bash
curl -X POST \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","password":"AdminPass123!"}'
```

2. **Fetch Device List**
```bash
curl -X GET \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/devices \
  -H 'Authorization: Bearer <your-jwt-token>'
```

3. **Create an Audio Preset**
```bash
curl -X POST \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/presets \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "presetName": "My Preset",
    "category": "music",
    "description": "Personal customization",
    "deviceId": "device-id-here",
    "isPublic": false,
    "profile": {
      "volume": 0.8,
      "eq": [2, 0, -1, 3, 1],
      "reverb": 0.5
    }
  }'
```

4. **Apply the Preset to a Device**
```bash
curl -X POST \
  https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev/api/devices/{device_id}/apply-preset \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{"presetId": "preset-id-here"}'
```

---

*Documentation Version: v1.0 | Last Updated: 2025-09-23*