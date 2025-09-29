/**
 * Audio profile model
 * Encapsulates volume, EQ, and reverb parameters
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
     * Validate audio profile inputs
     */
    validate() {
        const errors = [];

        if (typeof this.volume !== 'number' || this.volume < 0 || this.volume > 1) {
            errors.push('Volume must be between 0 and 1');
        }

        if (typeof this.reverb !== 'number' || this.reverb < 0 || this.reverb > 1) {
            errors.push('Reverb must be between 0 and 1');
        }

        if (!Array.isArray(this.eq)) {
            errors.push('EQ settings must be provided as an array');
        } else if (this.eq.length !== 5) {
            errors.push('EQ settings must include 5 bands');
        } else {
            for (let i = 0; i < this.eq.length; i++) {
                const eq = this.eq[i];
                if (typeof eq !== 'number' || eq < -12 || eq > 12) {
                    errors.push(`EQ band ${i + 1} must be between -12 and 12`);
                }
            }
        }

        if (this.last_preset_id && typeof this.last_preset_id !== 'string') {
            errors.push('Last applied preset ID must be a string');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Convert to DynamoDB persistence format
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
     * Convert to Flutter client format
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
     * Build an AudioProfile instance from a preset definition
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
     * Build an instance from DynamoDB format
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
     * Apply updates to the profile
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
     * Reset to default values
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
     * Compare with another profile (ignoring timestamps)
     */
    equals(other) {
        if (!(other instanceof AudioProfile)) return false;
        
        return this.volume === other.volume &&
               this.reverb === other.reverb &&
               JSON.stringify(this.eq) === JSON.stringify(other.eq) &&
               this.last_preset_id === other.last_preset_id;
    }

    /**
     * Clone the profile
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
     * Create a default audio profile
     */
    static createDefault() {
        return new AudioProfile({
            volume: 0.5,
            eq: [0, 0, 0, 0, 0],
            reverb: 0.3
        });
    }

    /**
     * Summarize key metrics for logging
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