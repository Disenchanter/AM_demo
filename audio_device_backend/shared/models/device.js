/**
 * Device data model (unified architecture version)
 * Encapsulates metadata plus full audio state.
 */

const { v4: uuidv4 } = require('uuid');
const AudioProfile = require('./audio-profile');

class Device {
    constructor(data = {}) {
        this.PK = data.PK || `DEVICE#${data.device_id || uuidv4()}`;
        this.SK = data.SK || 'DEVICE';
        this.EntityType = 'Device';
        this.device_id = data.device_id || this.PK.replace('DEVICE#', '');
    this.device_name = data.device_name || 'Default Audio Device';
        this.device_model = data.device_model || '';
        this.owner_id = data.owner_id || '';
        this.state = data.state ? AudioProfile.fromDynamoFormat(data.state) : AudioProfile.createDefault();
        this.is_online = data.is_online ?? false;
        this.last_seen = data.last_seen || new Date().toISOString();
        this.created_at = data.created_at || new Date().toISOString();
        this.updated_at = data.updated_at || new Date().toISOString();
    }

    /**
     * Validate device integrity.
     */
    validate() {
        const errors = [];

        if (!this.device_id || this.device_id.trim().length === 0) {
            errors.push('Device ID is required');
        }

        if (!this.device_name || this.device_name.trim().length === 0) {
            errors.push('Device name is required');
        }

        if (this.device_name.length > 50) {
            errors.push('Device name must not exceed 50 characters');
        }

        if (!this.owner_id || this.owner_id.trim().length === 0) {
            errors.push('Device owner ID is required');
        }

        if (this.device_model && this.device_model.length > 100) {
            errors.push('Device model must not exceed 100 characters');
        }

    // Validate audio state
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
     * Serialize to a DynamoDB item.
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
     * Convert to the full API response shape.
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
     * Convert to a lightweight Flutter payload.
     */
    toFlutterFormat() {
        return {
            id: this.device_id,
            name: this.device_name,
            state: this.state.toFlutterFormat()
        };
    }

    /**
     * Hydrate a device instance from a DynamoDB item.
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
     * Update core device metadata.
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
     * Update the device audio state.
     */
    updateState(audioUpdates) {
        this.state.update(audioUpdates);
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * Apply a preset to this device.
     */
    applyPreset(preset) {
        const presetProfile = AudioProfile.fromPreset(preset.profile, preset.preset_id);
        this.state = presetProfile;
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * Mark the device online.
     */
    setOnline() {
        this.is_online = true;
        this.last_seen = new Date().toISOString();
        this.updated_at = this.last_seen;
        return this;
    }

    /**
     * Mark the device offline.
     */
    setOffline() {
        this.is_online = false;
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * Determine whether the user owns the device.
     */
    isOwnedBy(userId) {
        return this.owner_id === userId;
    }

    /**
     * Determine whether the user can manage the device.
     */
    canManage(userId, userRole) {
        return this.owner_id === userId || userRole === 'admin';
    }

    /**
     * Create a default device instance.
     */
    static createDefault(deviceId, ownerId, deviceName = 'Default Audio Device') {
        return new Device({
            device_id: deviceId,
            device_name: deviceName,
            device_model: '',
            owner_id: ownerId,
            state: AudioProfile.createDefault()
        });
    }

    /**
     * Summarize device state for analytics.
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