/**
 * Preset data model (unified architecture version)
 * Works with the DynamoDB single-table schema and AudioProfile helper.
 */

const { v4: uuidv4 } = require('uuid');
const AudioProfile = require('./audio-profile');

class Preset {
    constructor(data = {}) {
        this.PK = data.PK || `PRESET#${data.preset_id || uuidv4()}`;
        this.SK = data.SK || 'PRESET';
        this.EntityType = 'Preset';
        this.preset_id = data.preset_id || this.PK.replace('PRESET#', '');
        this.preset_name = data.preset_name || '';
        this.preset_category = data.preset_category || '';
        this.profile = data.profile ? AudioProfile.fromDynamoFormat(data.profile) : AudioProfile.createDefault();
        this.created_by = data.created_by || '';
        this.creator_role = data.creator_role || 'user';
        this.is_public = data.is_public ?? true;
        this.description = data.description || '';
        this.usage_count = data.usage_count || 0;
        this.created_at = data.created_at || new Date().toISOString();
        this.updated_at = data.updated_at || new Date().toISOString();
    }

    /**
     * Validate preset integrity.
     */
    validate() {
        const errors = [];

        if (!this.preset_name || this.preset_name.trim().length === 0) {
            errors.push('Preset name is required');
        }

        if (this.preset_name.length > 50) {
            errors.push('Preset name must not exceed 50 characters');
        }

        if (!this.created_by || this.created_by.trim().length === 0) {
            errors.push('Creator ID is required');
        }

    // Validate audio profile details
        const profileValidation = this.profile.validate();
        if (!profileValidation.isValid) {
            errors.push(...profileValidation.errors);
        }

        if (!['admin', 'user'].includes(this.creator_role)) {
            errors.push('Creator role must be either admin or user');
        }

        // Only admins may create public presets
        if (this.is_public && this.creator_role !== 'admin') {
            errors.push('Only admins can create public presets');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check whether a user can access this preset.
     * @param {string} userId - Current user ID
     * @param {string} userRole - Current user role ('admin' or 'user')
     * @returns {boolean} Whether the preset is visible to the user
     */
    canUserView(userId, userRole) {
        // Admins can access every preset
        if (userRole === 'admin') {
            return true;
        }

        // Creators can see their own presets
        if (this.created_by === userId) {
            return true;
        }

        // Public presets are visible to all users
        if (this.is_public) {
            return true;
        }

        // Everything else is hidden
        return false;
    }

    /**
     * Determine if a user can create a public preset.
     * @param {string} userRole - User role
     * @param {boolean} isPublic - Whether the preset should be public
     * @returns {boolean} Whether creation is allowed
     */
    static canCreatePublicPreset(userRole, isPublic) {
        if (!isPublic) {
            return true; // Everyone may create private presets
        }
        return userRole === 'admin'; // Only admins can publish presets
    }

    /**
     * Serialize to a DynamoDB item.
     */
    toDynamoItem() {
        return {
            PK: this.PK,
            SK: this.SK,
            EntityType: this.EntityType,
            preset_id: this.preset_id,
            preset_name: this.preset_name,
            preset_category: this.preset_category,
            profile: this.profile.toDynamoFormat(),
            created_by: this.created_by,
            creator_role: this.creator_role,
            is_public: this.is_public,
            description: this.description,
            usage_count: this.usage_count,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * Convert to API response payload.
     */
    toApiResponse() {
        return {
            id: this.preset_id,
            name: this.preset_name,
            category: this.preset_category,
            profile: this.profile.toFlutterFormat(),
            createdBy: this.created_by,
            creatorRole: this.creator_role,
            isPublic: this.is_public,
            description: this.description,
            usageCount: this.usage_count,
            createdAt: this.created_at,
            updatedAt: this.updated_at
        };
    }

    /**
     * Convert to a lightweight Flutter-friendly payload.
     */
    toFlutterFormat() {
        return {
            id: this.preset_id,
            name: this.preset_name,
            profile: this.profile.toFlutterFormat(),
            createdBy: this.created_by
        };
    }

    /**
     * Hydrate a preset from a DynamoDB item.
     */
    static fromDynamoItem(item) {
        return new Preset({
            PK: item.PK,
            SK: item.SK,
            preset_id: item.preset_id,
            preset_name: item.preset_name,
            preset_category: item.preset_category,
            profile: item.profile,
            created_by: item.created_by,
            creator_role: item.creator_role,
            is_public: item.is_public,
            description: item.description,
            usage_count: item.usage_count,
            created_at: item.created_at,
            updated_at: item.updated_at
        });
    }

    /**
     * Update preset metadata and profile.
     */
    update(updates) {
        if (updates.preset_name) this.preset_name = updates.preset_name;
        if (updates.preset_category) this.preset_category = updates.preset_category;
        if (updates.description !== undefined) this.description = updates.description;
        if (typeof updates.is_public === 'boolean') this.is_public = updates.is_public;
        
        // Update the audio profile
        if (updates.profile) {
            this.profile.update(updates.profile);
        }
        
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * Increment usage counter.
     */
    incrementUsage() {
        this.usage_count += 1;
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * Determine whether the user can manage this preset.
     */
    canManage(userId, userRole) {
        // Admins manage all presets; standard users manage only their own
        return userRole === 'admin' || this.created_by === userId;
    }

    /**
     * Determine whether the user can view this preset.
     */
    canView(userId, userRole) {
        // Public presets are visible to everyone; private presets are limited
        return this.is_public || this.created_by === userId || userRole === 'admin';
    }

    /**
     * Determine whether the user can use this preset.
     */
    canUse(userId, userRole) {
        return this.canView(userId, userRole);
    }

    /**
     * Generate the system default presets.
     */
    static getDefaultPresets() {
        const now = new Date().toISOString();
        
        return [
            new Preset({
                preset_name: 'Flat',
                preset_category: 'Standard',
                profile: {
                    volume: 0.5,
                    eq: [0, 0, 0, 0, 0],
                    reverb: 0.3
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: 'Balanced audio settings suitable for most content',
                created_at: now,
                updated_at: now
            }),
            new Preset({
                preset_name: 'Rock',
                preset_category: 'Music',
                profile: {
                    volume: 0.65,
                    eq: [3, 2, -1, 2, 4],
                    reverb: 0.4
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: 'Boosts lows and highs, tailored for rock music',
                created_at: now,
                updated_at: now
            }),
            new Preset({
                preset_name: 'Pop',
                preset_category: 'Music',
                profile: {
                    volume: 0.6,
                    eq: [-1, 2, 3, 1, 2],
                    reverb: 0.35
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: 'Highlights vocals, ideal for pop tracks',
                created_at: now,
                updated_at: now
            }),
            new Preset({
                preset_name: 'Classical',
                preset_category: 'Music',
                profile: {
                    volume: 0.55,
                    eq: [0, -2, 0, 2, 1],
                    reverb: 0.5
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: 'Natural tonality tuned for classical music',
                created_at: now,
                updated_at: now
            }),
            new Preset({
                preset_name: 'Cinema',
                preset_category: 'Entertainment',
                profile: {
                    volume: 0.7,
                    eq: [2, 0, -1, 3, 2],
                    reverb: 0.6
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: 'Wider dynamic range for movie soundtracks',
                created_at: now,
                updated_at: now
            })
        ];
    }

    /**
     * Filter presets by category.
     */
    static filterByCategory(presets, category) {
        if (!category || category === 'all') {
            return presets;
        }
        return presets.filter(preset => preset.preset_category === category);
    }

    /**
     * Summarize preset usage statistics.
     */
    getUsageSummary() {
        return {
            preset_id: this.preset_id,
            preset_name: this.preset_name,
            category: this.preset_category,
            usage_count: this.usage_count,
            is_popular: this.usage_count > 10,
            created_by_role: this.creator_role,
            last_updated: this.updated_at
        };
    }
}

module.exports = Preset;