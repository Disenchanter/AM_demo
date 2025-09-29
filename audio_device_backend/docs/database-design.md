# Audio Device Management System - Database Design (Unified Architecture)

## Architectural Principles

**Separation of concerns between frontend and backend:**
- **Frontend (Flutter)**: Lightweight data structures focused on user interaction.
- **Backend (AWS)**: Authoritative data store with multi-user persistence.

## Data Model Mapping

| Model            | Frontend (Flutter)                          | Backend (AWS)                                   |
| ---------------- | ------------------------------------------- | ----------------------------------------------- |
| **User**         | Minimal login state (username, isAdmin)     | Cognito user pool with credentials and groups   |
| **Device**       | Device(id, name, state)                     | DynamoDB `DEVICE#id` item with full state payload |
| **AudioProfile** | Volume/EQ/reverb parameters                 | Embedded in `Device.state` and `Preset.profile` |
| **Preset**       | Preset(id, name, profile, createdBy)        | DynamoDB `PRESET#id` with creator metadata      |

## DynamoDB Single-table Design

**Table name**: `AudioManagement-{environment}`

### Primary Key Pattern
- **PK (Partition Key)**: Entity type + identifier (for example: `DEVICE#001`, `PRESET#123`).
- **SK (Sort Key)**: Entity detail marker or relationship descriptor.

### Data Shapes

#### 1. Device item (`DEVICE#id`)

```json
{
  "PK": "DEVICE#device-001",
  "SK": "DEVICE",
  "EntityType": "Device",
  "device_id": "device-001",
  "device_name": "Living Room Sound System",
  "device_model": "Bose SoundLink", 
  "owner_id": "cognito-user-uuid",
  "state": {
    "volume": 0.7,
    "eq": [2.0, 1.5, 0.0, -1.0, 2.5],
    "reverb": 0.4,
    "last_preset_id": "preset-123"
  },
  "is_online": true,
  "last_seen": "2025-01-15T10:30:00Z",
  "created_at": "2025-01-15T08:00:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

#### 2. Preset item (`PRESET#id`)

```json
{
  "PK": "PRESET#preset-123",
  "SK": "PRESET", 
  "EntityType": "Preset",
  "preset_id": "preset-123",
  "preset_name": "Rock Boost",
  "preset_category": "Music",
  "profile": {
    "volume": 0.8,
    "eq": [3.0, 2.0, -1.0, 2.0, 4.0],
    "reverb": 0.5
  },
  "created_by": "cognito-user-uuid",
  "creator_role": "admin",
  "is_public": true,
  "description": "Boosts lows and highs for rock tracks",
  "usage_count": 45,
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```
```

**Global Secondary Index (GSI):**
- **GSI1**: `owner_id-created_at-index`
  - PK: `owner_id`
  - SK: `created_at`
  - Purpose: Query devices that belong to a user.

**Notes:**
- Real-time state (volume, EQ, etc.) can be cached on the Flutter client.
- Device identity and ownership remain authoritative in DynamoDB for permissions and preset linkage.

### 2. Preset Table (Audio Preset Catalog)

**Table name**: `AudioPresets-{environment}`

**Purpose**: Store reusable audio presets that can be shared across devices.

**Primary key design:**
- **PK (Partition Key)**: `preset_id` (string UUID)

**Attribute structure:**
```json
{
  "preset_id": "preset-uuid-string",       // Primary key
  "preset_name": "Rock Boost",             // Preset name
  "preset_category": "Rock",               // Optional category label
  "volume": 0.75,                           // Recommended volume (0.0 to 1.0)
  "eq_settings": [3.0, 2.0, -1.0, 2.0, 4.0], // EQ curve (-12 to +12)
  "reverb": 0.4,                            // Reverb amount (0.0 to 1.0)
  "created_by": "cognito-user-uuid",       // Cognito user ID of creator
  "creator_role": "admin",                 // Creator role (admin/user)
  "is_public": true,                        // Public preset flag
  "description": "EQ tuned for rock music",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

#### 3. User-to-Device relationship (`USER#id`)

```json
{
  "PK": "USER#cognito-user-uuid",
  "SK": "DEVICE#device-001",
  "EntityType": "UserDevice",
  "device_id": "device-001",
  "device_name": "Living Room Sound System",
  "relationship": "owner",
  "created_at": "2025-01-15T08:00:00Z"
}
```

### Global Secondary Indexes (GSIs)

#### GSI1: EntityType-CreatedAt-Index
- **PK**: `EntityType` (Device, Preset, UserDevice)
- **SK**: `created_at`
- **Use case**: Query entities by type and creation time.

#### GSI2: OwnerID-CreatedAt-Index  
- **PK**: `owner_id`
- **SK**: `created_at`
- **Use case**: Look up devices and presets created by a given user.

## Data Access Patterns

### Device Management
1. **Get device details**: `GET DEVICE#id`
2. **List devices owned by a user**: Query GSI2 with `owner_id = user-id`
3. **Update device state**: `UPDATE DEVICE#id SET state = {...}`
4. **Toggle online status**: `UPDATE DEVICE#id SET is_online, last_seen`

### Preset Management
1. **List public presets**: Query GSI1 with `EntityType = Preset` and `is_public = true`
2. **List presets created by a user**: Query GSI2 with `owner_id = user-id` and `EntityType = Preset`
3. **Create preset**: `PUT PRESET#new-id`
4. **Apply preset to a device**:
   - `GET PRESET#id` to fetch the preset profile
   - `UPDATE DEVICE#id SET state = preset.profile`
   - `UPDATE PRESET#id SET usage_count = usage_count + 1`

### Frontend Synchronization Flow
1. **Fetch device state**: Retrieve the authoritative device item from DynamoDB.
2. **Local updates**: Adjust the in-app `AudioProfile` in real time.
3. **State sync**: Periodically or manually push local changes back to the backend.
4. **Preset swap**: Pull preset data from the backend and apply it locally and remotely.

## AudioProfile Data Structures

```typescript
// Lightweight structure on the Flutter side
class AudioProfile {
  double volume;          // 0.0 - 1.0
  List<double> eq;        // Five bands, -12.0 to 12.0  
  double reverb;          // 0.0 - 1.0
  String? lastPresetId;   // Last applied preset ID
}

// Authoritative structure persisted in AWS
{
  "volume": 0.7,
  "eq": [2.0, 1.5, 0.0, -1.0, 2.5],
  "reverb": 0.4,
  "last_preset_id": "preset-123",
  "updated_at": "2025-01-15T10:30:00Z",
  "sync_version": 15  // Versioning to prevent conflicts
}
```

## User Management (AWS Cognito)

**Cognito user pool configuration:**
```json
{
  "UserPoolName": "AudioDeviceUsers",
  "Attributes": [
    "email",
    "preferred_username"
  ],
  "Groups": [
    {
      "GroupName": "AdminGroup",
      "Description": "Administrator group",
      "Precedence": 1
    },
    {
      "GroupName": "UserGroup", 
      "Description": "Standard user group",
      "Precedence": 2
    }
  ]
}
```

**User attributes:**
- `sub`: Cognito-generated user identifier
- `preferred_username`: Display name
- `email`: Email address
- `cognito:groups`: Assigned groups (AdminGroup/UserGroup)

## MVP Data Access Scenarios

### Device Management
1. **List devices for a user**: Query GSI1 with the user’s `owner_id`
2. **Fetch device details**: GetItem on the device partition key
3. **Update device state**: UpdateItem on the device item
4. **Register a device**: PutItem to create the device entry

### Preset Management
1. **List presets for a device**: Query GSI1 with `device_id`
2. **List public presets**: Scan Presets table filtering `is_public = true`
3. **Create preset** (admin only): PutItem into Presets
4. **Delete preset** (admin only): DeleteItem from Presets
5. **Apply preset**:
   - GetItem on the preset
   - UpdateItem on the device to persist the preset’s state

### Authentication
1. **User login**: Cognito SDK authentication
2. **Retrieve user info**: Parse claims from the JWT token
3. **Enforce authorization**: Evaluate group membership (AdminGroup/UserGroup)

## MVP Authorization Model

**Administrator capabilities:**
- ✅ View all devices and presets
- ✅ Create, update, and delete presets
- ✅ Manage owned devices
- ✅ Apply any preset to any device

**Standard user capabilities:**
- ✅ View public presets
- ✅ Manage owned devices
- ✅ Apply public presets to owned devices
- ❌ Create or delete presets

## Lightweight Capacity Planning

**Estimated footprint (MVP phase):**
- **Devices**: ~50-200 items → ~1 KB each → ~200 KB total
- **Presets**: ~20-100 items → ~0.5 KB each → ~50 KB total
- **Users**: Managed in Cognito, no DynamoDB storage cost

**Total storage**: ~250 KB (negligible cost)

**Read/write mode**: On-Demand (ideal for unpredictable MVP traffic)

## Simplified API Design

**Core API endpoints:**
```
GET    /devices              # List devices for the authenticated user
POST   /devices              # Register a new device  
GET    /devices/{id}         # Fetch device details
PUT    /devices/{id}         # Update device state

GET    /presets              # List presets (optionally filtered by device)
POST   /presets              # Create a preset (admins only)
DELETE /presets/{id}         # Delete a preset (admins only)
POST   /devices/{id}/apply-preset  # Apply a preset to a device
```

This MVP-focused design targets the essential use cases, trimming non-critical complexity to speed up development and deployment.