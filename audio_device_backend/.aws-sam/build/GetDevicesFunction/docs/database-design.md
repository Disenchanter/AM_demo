# 音频设备管理系统 - 数据库设计 (统一架构)

## 架构理念

**前后端数据分层**：
- **前端 (Flutter)**: 轻量级数据结构，专注用户交互
- **后端 (AWS)**: 完整数据存储，支持多用户和持久化

## 数据模型对照

| 模型               | 前端 (Flutter)                         | 后端 (AWS)                               |
| ---------------- | ------------------------------------ | -------------------------------------- |
| **User**         | 只存登录状态（username, isAdmin）            | Cognito 用户池，含密码、分组                     |
| **Device**       | Device(id, name, state)              | DynamoDB `DEVICE#id`，含完整状态             |
| **AudioProfile** | 音量/EQ/混响参数                           | 存在 `Device.state` & `Preset.profile`   |
| **Preset**       | Preset(id, name, profile, createdBy) | DynamoDB `PRESET#id`，含创建人、时间            |

## DynamoDB 单表设计

**表名**: `AudioManagement-{environment}`

### 主键设计
- **PK (Partition Key)**: 实体类型 + ID（如：`DEVICE#001`, `PRESET#123`）
- **SK (Sort Key)**: 实体详情或关系标识

### 数据结构

#### 1. 设备记录 (DEVICE#id)

```json
{
  "PK": "DEVICE#device-001",
  "SK": "DEVICE",
  "EntityType": "Device",
  "device_id": "device-001",
  "device_name": "客厅音响系统",
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

#### 2. 预设记录 (PRESET#id)

```json
{
  "PK": "PRESET#preset-123",
  "SK": "PRESET", 
  "EntityType": "Preset",
  "preset_id": "preset-123",
  "preset_name": "摇滚增强",
  "preset_category": "音乐",
  "profile": {
    "volume": 0.8,
    "eq": [3.0, 2.0, -1.0, 2.0, 4.0],
    "reverb": 0.5
  },
  "created_by": "cognito-user-uuid",
  "creator_role": "admin",
  "is_public": true,
  "description": "增强低频和高频，适合摇滚音乐",
  "usage_count": 45,
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```
```

```

**全局二级索引 (GSI)**:
- **GSI1**: `owner_id-created_at-index`
  - PK: `owner_id`
  - SK: `created_at` 
  - 用途: 按用户查询其注册的设备列表

**说明**: 
- 不存储实时状态（音量、EQ等），这些保存在Flutter应用本地
- 只记录设备身份信息，用于权限验证和预设关联

### 2. Presets 表 (音频预设表)

**表名**: `AudioPresets-{environment}`

**目的**: 存储通用音频预设配置，可跨设备使用

**主键设计**:
- **PK (Partition Key)**: `preset_id` (String) - UUID格式

**属性结构**:
```json
{
  "preset_id": "preset-uuid-string",       // 主键
  "preset_name": "摇滚增强",               // 预设名称
  "preset_category": "摇滚",               // 预设分类 (可选)
  "volume": 0.75,                         // 推荐音量 (0.0 to 1.0)
  "eq_settings": [3.0, 2.0, -1.0, 2.0, 4.0], // EQ设置 (-12 to +12)
  "reverb": 0.4,                          // 混响设置 (0.0 to 1.0)
  "created_by": "cognito-user-uuid",      // 创建者Cognito用户ID
  "creator_role": "admin",                // 创建者角色 (admin/user)
  "is_public": true,                      // 是否为公开预设
  "description": "适合摇滚音乐的EQ设置",   // 预设描述 (可选)
  "created_at": "2025-01-15T10:30:00Z",   // 创建时间
  "updated_at": "2025-01-15T10:30:00Z"    // 更新时间
}
#### 3. 用户设备关系 (USER#id)

```json
{
  "PK": "USER#cognito-user-uuid",
  "SK": "DEVICE#device-001",
  "EntityType": "UserDevice",
  "device_id": "device-001",
  "device_name": "客厅音响系统",
  "relationship": "owner",
  "created_at": "2025-01-15T08:00:00Z"
}
```

### 全局二级索引 (GSI)

#### GSI1: EntityType-CreatedAt-Index
- **PK**: `EntityType` (Device, Preset, UserDevice)
- **SK**: `created_at`
- **用途**: 按类型和时间查询实体

#### GSI2: OwnerID-CreatedAt-Index  
- **PK**: `owner_id`
- **SK**: `created_at`
- **用途**: 查询用户拥有的设备和创建的预设

## 数据访问模式

### 设备管理
1. **获取设备详情**: `GET DEVICE#id`
2. **获取用户设备列表**: Query GSI2 `owner_id = user-id`
3. **更新设备状态**: `UPDATE DEVICE#id SET state = {...}`
4. **设备上线/下线**: `UPDATE DEVICE#id SET is_online, last_seen`

### 预设管理  
1. **获取所有公开预设**: Query GSI1 `EntityType = Preset, is_public = true`
2. **获取用户创建的预设**: Query GSI2 `owner_id = user-id, EntityType = Preset`
3. **创建预设**: `PUT PRESET#new-id`
4. **应用预设到设备**: 
   - `GET PRESET#id` 获取预设配置
   - `UPDATE DEVICE#id SET state = preset.profile`
   - `UPDATE PRESET#id SET usage_count = usage_count + 1`

### 前端同步模式
1. **设备状态查询**: 从云端获取完整Device记录
2. **本地状态更新**: 实时更新Flutter本地AudioProfile
3. **状态同步**: 定期或手动将本地状态推送到云端
4. **预设切换**: 从云端获取预设，应用到本地和云端设备状态

## AudioProfile 数据结构

```typescript
// Flutter端轻量级结构
class AudioProfile {
  double volume;          // 0.0 - 1.0
  List<double> eq;        // 5个频段，-12.0 到 12.0  
  double reverb;          // 0.0 - 1.0
  String? lastPresetId;   // 最后应用的预设ID
}

// AWS端完整结构
{
  "volume": 0.7,
  "eq": [2.0, 1.5, 0.0, -1.0, 2.5],
  "reverb": 0.4,
  "last_preset_id": "preset-123",
  "updated_at": "2025-01-15T10:30:00Z",
  "sync_version": 15  // 版本控制，防止冲突
}
```

## 用户管理（AWS Cognito）

**Cognito 用户池配置**:
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
      "Description": "管理员用户组",
      "Precedence": 1
    },
    {
      "GroupName": "UserGroup", 
      "Description": "普通用户组",
      "Precedence": 2
    }
  ]
}
```

**用户属性**:
- `sub`: Cognito自动生成的用户ID
- `preferred_username`: 用户名
- `email`: 邮箱
- `cognito:groups`: 用户组 (AdminGroup/UserGroup)

## MVP 数据访问模式

### 设备管理
1. **获取用户设备列表**: Query GSI1 (owner_id)
2. **获取设备详情**: GetItem Devices (device_id)
3. **更新设备状态**: UpdateItem Devices
4. **创建新设备**: PutItem Devices

### 预设管理  
1. **获取设备的所有预设**: Query GSI1 (device_id)
2. **获取公开预设**: Scan Presets (filter: is_public=true)
3. **创建预设** (Admin only): PutItem Presets
4. **删除预设** (Admin only): DeleteItem Presets
5. **应用预设到设备**: 
   - GetItem Presets (获取预设)
   - UpdateItem Devices (更新设备状态)

### 用户认证
1. **用户登录**: Cognito SDK认证
2. **获取用户信息**: 从JWT Token解析
3. **权限验证**: 检查用户组 (AdminGroup/UserGroup)

## MVP 权限模型

**Admin 用户权限**:
- ✅ 查看所有设备和预设
- ✅ 创建、修改、删除预设  
- ✅ 管理自己的设备
- ✅ 应用任意预设到设备

**普通用户权限**:
- ✅ 查看公开预设
- ✅ 管理自己的设备
- ✅ 应用公开预设到设备
- ❌ 创建、删除预设

## 简化的容量规划

**预估数据量** (MVP阶段):
- **Devices**: ~50-200 设备 → ~1KB/项 → ~200KB
- **Presets**: ~20-100 预设 → ~0.5KB/项 → ~50KB
- **Users**: 在Cognito中管理，DynamoDB无额外存储

**总存储**: ~250KB (极小，几乎零成本)

**读写模式**: On-Demand (最适合MVP阶段的不规律访问)

## API 设计简化

**核心 API 端点**:
```
GET    /devices              # 获取用户设备列表
POST   /devices              # 创建新设备  
GET    /devices/{id}         # 获取设备详情
PUT    /devices/{id}         # 更新设备状态

GET    /presets              # 获取预设列表(按设备过滤)
POST   /presets              # 创建预设 (Admin only)
DELETE /presets/{id}         # 删除预设 (Admin only) 
POST   /devices/{id}/apply-preset  # 应用预设到设备
```

这个MVP设计专注于核心功能，去掉了不必要的复杂性，更适合快速开发和部署。