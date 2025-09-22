/**
 * 设备数据模型 (统一架构版)
 * 包含完整设备信息和音频状态
 */

const { v4: uuidv4 } = require('uuid');
const AudioProfile = require('./audio-profile');

class Device {
    constructor(data = {}) {
        this.PK = data.PK || `DEVICE#${data.device_id || uuidv4()}`;
        this.SK = data.SK || 'DEVICE';
        this.EntityType = 'Device';
        this.device_id = data.device_id || this.PK.replace('DEVICE#', '');
        this.device_name = data.device_name || '默认音频设备';
        this.device_model = data.device_model || '';
        this.owner_id = data.owner_id || '';
        this.state = data.state ? AudioProfile.fromDynamoFormat(data.state) : AudioProfile.createDefault();
        this.is_online = data.is_online ?? false;
        this.last_seen = data.last_seen || new Date().toISOString();
        this.created_at = data.created_at || new Date().toISOString();
        this.updated_at = data.updated_at || new Date().toISOString();
    }

    /**
     * 验证设备数据有效性
     */
    validate() {
        const errors = [];

        if (!this.device_id || this.device_id.trim().length === 0) {
            errors.push('设备ID不能为空');
        }

        if (!this.device_name || this.device_name.trim().length === 0) {
            errors.push('设备名称不能为空');
        }

        if (this.device_name.length > 50) {
            errors.push('设备名称不能超过50个字符');
        }

        if (!this.owner_id || this.owner_id.trim().length === 0) {
            errors.push('设备拥有者ID不能为空');
        }

        if (this.device_model && this.device_model.length > 100) {
            errors.push('设备型号不能超过100个字符');
        }

        // 验证音频状态
        const stateValidation = this.state.validate();
        if (!stateValidation.isValid) {
            errors.push(...stateValidation.errors);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为DynamoDB项目格式
     */
    toDynamoItem() {
        return {
            PK: this.PK,
            SK: this.SK,
            EntityType: this.EntityType,
            device_id: this.device_id,
            device_name: this.device_name,
            device_model: this.device_model,
            owner_id: this.owner_id,
            state: this.state.toDynamoFormat(),
            is_online: this.is_online,
            last_seen: this.last_seen,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * 转换为API响应格式 (完整)
     */
    toApiResponse() {
        return {
            deviceId: this.device_id,
            deviceName: this.device_name,
            deviceModel: this.device_model,
            ownerId: this.owner_id,
            state: this.state.toFlutterFormat(),
            isOnline: this.is_online,
            lastSeen: this.last_seen,
            createdAt: this.created_at,
            updatedAt: this.updated_at
        };
    }

    /**
     * 转换为Flutter前端格式 (轻量级)
     */
    toFlutterFormat() {
        return {
            id: this.device_id,
            name: this.device_name,
            state: this.state.toFlutterFormat()
        };
    }

    /**
     * 从DynamoDB项目创建设备实例
     */
    static fromDynamoItem(item) {
        return new Device({
            PK: item.PK,
            SK: item.SK,
            device_id: item.device_id,
            device_name: item.device_name,
            device_model: item.device_model,
            owner_id: item.owner_id,
            state: item.state,
            is_online: item.is_online,
            last_seen: item.last_seen,
            created_at: item.created_at,
            updated_at: item.updated_at
        });
    }

    /**
     * 更新设备基本信息
     */
    updateInfo(updates) {
        if (updates.device_name && updates.device_name.trim()) {
            this.device_name = updates.device_name.trim();
        }

        if (updates.device_model !== undefined) {
            this.device_model = updates.device_model.trim();
        }

        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * 更新设备音频状态
     */
    updateState(audioUpdates) {
        this.state.update(audioUpdates);
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * 应用预设到设备
     */
    applyPreset(preset) {
        const presetProfile = AudioProfile.fromPreset(preset.profile, preset.preset_id);
        this.state = presetProfile;
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * 设备上线
     */
    setOnline() {
        this.is_online = true;
        this.last_seen = new Date().toISOString();
        this.updated_at = this.last_seen;
        return this;
    }

    /**
     * 设备下线
     */
    setOffline() {
        this.is_online = false;
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * 检查用户是否为设备拥有者
     */
    isOwnedBy(userId) {
        return this.owner_id === userId;
    }

    /**
     * 检查用户是否可以管理此设备
     */
    canManage(userId, userRole) {
        return this.owner_id === userId || userRole === 'admin';
    }

    /**
     * 创建默认设备
     */
    static createDefault(deviceId, ownerId, deviceName = '默认音频设备') {
        return new Device({
            device_id: deviceId,
            device_name: deviceName,
            device_model: '',
            owner_id: ownerId,
            state: AudioProfile.createDefault()
        });
    }

    /**
     * 获取设备状态摘要
     */
    getStateSummary() {
        return {
            device_id: this.device_id,
            device_name: this.device_name,
            is_online: this.is_online,
            audio_state: this.state.getSummary(),
            last_updated: this.updated_at
        };
    }
}

module.exports = Device;