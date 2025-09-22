/**
 * 音频配置文件模型
 * 封装音量、EQ、混响参数
 */

class AudioProfile {
    constructor(data = {}) {
        this.volume = data.volume ?? 0.5;
        this.eq = data.eq || [0, 0, 0, 0, 0];
        this.reverb = data.reverb ?? 0.3;
        this.last_preset_id = data.last_preset_id || null;
        this.updated_at = data.updated_at || new Date().toISOString();
        this.sync_version = data.sync_version || 1;
    }

    /**
     * 验证音频配置有效性
     */
    validate() {
        const errors = [];

        if (typeof this.volume !== 'number' || this.volume < 0 || this.volume > 1) {
            errors.push('音量值必须在0到1之间');
        }

        if (typeof this.reverb !== 'number' || this.reverb < 0 || this.reverb > 1) {
            errors.push('混响值必须在0到1之间');
        }

        if (!Array.isArray(this.eq)) {
            errors.push('EQ设置必须是数组格式');
        } else if (this.eq.length !== 5) {
            errors.push('EQ设置必须包含5个频段');
        } else {
            for (let i = 0; i < this.eq.length; i++) {
                const eq = this.eq[i];
                if (typeof eq !== 'number' || eq < -12 || eq > 12) {
                    errors.push(`EQ频段${i + 1}值必须在-12到12之间`);
                }
            }
        }

        if (this.last_preset_id && typeof this.last_preset_id !== 'string') {
            errors.push('最后应用预设ID必须是字符串');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为DynamoDB存储格式
     */
    toDynamoFormat() {
        return {
            volume: this.volume,
            eq: this.eq,
            reverb: this.reverb,
            last_preset_id: this.last_preset_id,
            updated_at: this.updated_at,
            sync_version: this.sync_version
        };
    }

    /**
     * 转换为Flutter前端格式
     */
    toFlutterFormat() {
        return {
            volume: this.volume,
            eq: [...this.eq],
            reverb: this.reverb,
            lastPresetId: this.last_preset_id
        };
    }

    /**
     * 从预设配置创建AudioProfile
     */
    static fromPreset(presetProfile, presetId = null) {
        return new AudioProfile({
            volume: presetProfile.volume,
            eq: [...presetProfile.eq],
            reverb: presetProfile.reverb,
            last_preset_id: presetId,
            updated_at: new Date().toISOString(),
            sync_version: 1
        });
    }

    /**
     * 从DynamoDB格式创建实例
     */
    static fromDynamoFormat(data) {
        return new AudioProfile({
            volume: data.volume,
            eq: data.eq,
            reverb: data.reverb,
            last_preset_id: data.last_preset_id,
            updated_at: data.updated_at,
            sync_version: data.sync_version || 1
        });
    }

    /**
     * 更新音频配置
     */
    update(updates) {
        if (typeof updates.volume === 'number') {
            this.volume = Math.max(0, Math.min(1, updates.volume));
        }

        if (Array.isArray(updates.eq) && updates.eq.length === 5) {
            this.eq = updates.eq.map(val => Math.max(-12, Math.min(12, val)));
        }

        if (typeof updates.reverb === 'number') {
            this.reverb = Math.max(0, Math.min(1, updates.reverb));
        }

        if (updates.last_preset_id !== undefined) {
            this.last_preset_id = updates.last_preset_id;
        }

        this.updated_at = new Date().toISOString();
        this.sync_version += 1;
        return this;
    }

    /**
     * 重置到默认值
     */
    reset() {
        this.volume = 0.5;
        this.eq = [0, 0, 0, 0, 0];
        this.reverb = 0.3;
        this.last_preset_id = null;
        this.updated_at = new Date().toISOString();
        this.sync_version += 1;
        return this;
    }

    /**
     * 比较两个配置是否相同（忽略时间戳）
     */
    equals(other) {
        if (!(other instanceof AudioProfile)) return false;
        
        return this.volume === other.volume &&
               this.reverb === other.reverb &&
               JSON.stringify(this.eq) === JSON.stringify(other.eq) &&
               this.last_preset_id === other.last_preset_id;
    }

    /**
     * 克隆配置
     */
    clone() {
        return new AudioProfile({
            volume: this.volume,
            eq: [...this.eq],
            reverb: this.reverb,
            last_preset_id: this.last_preset_id,
            updated_at: this.updated_at,
            sync_version: this.sync_version
        });
    }

    /**
     * 创建默认音频配置
     */
    static createDefault() {
        return new AudioProfile({
            volume: 0.5,
            eq: [0, 0, 0, 0, 0],
            reverb: 0.3
        });
    }

    /**
     * 获取配置摘要（用于日志）
     */
    getSummary() {
        return {
            volume: this.volume,
            eq_max: Math.max(...this.eq),
            eq_min: Math.min(...this.eq),
            reverb: this.reverb,
            last_preset: this.last_preset_id,
            version: this.sync_version
        };
    }
}

module.exports = AudioProfile;