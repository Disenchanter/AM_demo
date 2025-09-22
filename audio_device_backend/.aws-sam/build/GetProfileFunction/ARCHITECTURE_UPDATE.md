# Audio Device Management - 单表架构更新总结

## 架构变更概述

已成功将后端架构从双表设计迁移到DynamoDB单表设计，以优化成本和性能。

## 主要变更

### 1. 数据模型重构
- **AudioProfile**: 音频参数封装模型，统一处理音量/EQ/混响
- **Device**: 更新为单表设计，使用 `PK=DEVICE#{id}`, `SK=METADATA`
- **Preset**: 更新为单表设计，使用 `PK=PRESET#{id}`, `SK=METADATA`

### 2. DynamoDB表结构
**旧设计** (双表):
```
DevicesTable: device_id (PK)
PresetsTable: preset_id (PK)
```

**新设计** (单表):
```
AudioManagementTable:
- PK (Partition Key): DEVICE#{id} | PRESET#{id}
- SK (Sort Key): METADATA
- GSI1PK: USER#{userId} | DEVICE#{deviceId}
- GSI1SK: DEVICE#{id} | PRESET#{createdAt}
```

### 3. 查询模式
- **用户设备查询**: GSI1, GSI1PK=USER#{userId}
- **设备预设查询**: GSI1, GSI1PK=DEVICE#{deviceId}
- **管理员查询**: 主表扫描，过滤PK前缀

### 4. Lambda函数更新
- **get-devices.js**: 更新为单表查询
- **update-device.js**: 使用新的PK/SK结构
- **get-presets.js**: 通过GSI1查询设备预设
- **create-preset.js**: 使用单表存储
- **apply-preset.js**: 更新设备状态查询

### 5. 环境变量更新
- `DEVICES_TABLE` → `AUDIO_MANAGEMENT_TABLE`
- `PRESETS_TABLE` → `AUDIO_MANAGEMENT_TABLE`

## 数据存储分配

| 数据类型 | 前端存储 | 后端存储 |
|---------|---------|---------|
| 设备基本信息 | ✓ (轻量) | ✓ (完整) |
| 实时音频状态 | ✓ | - |
| 历史记录 | - | ✓ |
| 用户预设 | - | ✓ |
| 管理员预设 | ✓ (缓存) | ✓ (权威) |

## 成本优化效果

1. **减少DynamoDB表数量**: 2个表 → 1个表
2. **降低管理复杂度**: 统一的访问模式
3. **减少跨表查询**: 单表关联查询
4. **优化读写单元**: 合并读写操作

## 部署说明

### 使用简化部署脚本:
```batch
deploy-simple.bat
```

### 或手动部署:
```bash
sam validate
sam build  
sam deploy --stack-name audio-device-backend-single --parameter-overrides Environment=dev --capabilities CAPABILITY_IAM
```

## 验证检查清单

- [ ] SAM模板验证通过
- [ ] 单表结构正确创建
- [ ] GSI索引配置正确
- [ ] Lambda函数环境变量更新
- [ ] API Gateway端点可访问
- [ ] Cognito用户池配置正确

## 后续工作

1. 更新Flutter前端集成新的API结构
2. 测试用户权限和预设功能
3. 监控性能和成本优化效果
4. 添加数据迁移脚本(如需要)

## 联系和支持

如有部署问题，请检查:
1. AWS凭证配置
2. SAM CLI安装
3. CloudFormation权限
4. 区域设置(默认us-east-1)