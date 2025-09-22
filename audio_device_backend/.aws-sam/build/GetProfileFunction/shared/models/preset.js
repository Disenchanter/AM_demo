/**
 * 预设数据模型 (统一架构版)
 * 使用DynamoDB单表设计和AudioProfile
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
     * 验证预设数据有效性
     */
    validate() {
        const errors = [];

        if (!this.preset_name || this.preset_name.trim().length === 0) {
            errors.push('预设名称不能为空');
        }

        if (this.preset_name.length > 50) {
            errors.push('预设名称不能超过50个字符');
        }

        if (!this.created_by || this.created_by.trim().length === 0) {
            errors.push('创建者ID不能为空');
        }

        // 验证音频配置
        const profileValidation = this.profile.validate();
        if (!profileValidation.isValid) {
            errors.push(...profileValidation.errors);
        }

        if (!['admin', 'user'].includes(this.creator_role)) {
            errors.push('创建者角色必须是admin或user');
        }

        // 验证公开预设权限：只有管理员可以创建公开预设
        if (this.is_public && this.creator_role !== 'admin') {
            errors.push('只有管理员可以创建公开预设');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 验证用户是否有权限查看此预设
     * @param {string} userId - 当前用户ID
     * @param {string} userRole - 当前用户角色 ('admin' 或 'user')
     * @returns {boolean} 是否有权限查看
     */
    canUserView(userId, userRole) {
        // 管理员可以查看所有预设
        if (userRole === 'admin') {
            return true;
        }

        // 用户可以查看自己创建的预设
        if (this.created_by === userId) {
            return true;
        }

        // 用户可以查看所有公开预设
        if (this.is_public) {
            return true;
        }

        // 其他情况不允许查看
        return false;
    }

    /**
     * 验证用户是否有权限创建公开预设
     * @param {string} userRole - 用户角色
     * @param {boolean} isPublic - 是否要创建公开预设
     * @returns {boolean} 是否有权限
     */
    static canCreatePublicPreset(userRole, isPublic) {
        if (!isPublic) {
            return true; // 所有用户都可以创建私有预设
        }
        return userRole === 'admin'; // 只有管理员可以创建公开预设
    }

    /**
     * 转换为DynamoDB项目格式
     */
    /**
     * 转换为DynamoDB项目格式
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
     * 转换为API响应格式
     */
    /**
     * 转换为API响应格式
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
     * 转换为Flutter前端格式 (轻量级)
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
     * 从DynamoDB项目创建预设实例
     */
    /**
     * 从DynamoDB项目创建预设实例
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
     * 更新预设信息
     */
    update(updates) {
        if (updates.preset_name) this.preset_name = updates.preset_name;
        if (updates.preset_category) this.preset_category = updates.preset_category;
        if (updates.description !== undefined) this.description = updates.description;
        if (typeof updates.is_public === 'boolean') this.is_public = updates.is_public;
        
        // 更新音频配置
        if (updates.profile) {
            this.profile.update(updates.profile);
        }
        
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * 增加使用次数
     */
    incrementUsage() {
        this.usage_count += 1;
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * 检查用户是否可以管理此预设
     */
    canManage(userId, userRole) {
        // Admin可以管理所有预设，普通用户只能管理自己创建的预设
        return userRole === 'admin' || this.created_by === userId;
    }

    /**
     * 检查用户是否可以查看此预设
     */
    canView(userId, userRole) {
        // 公开预设所有人可见，私有预设只有创建者和Admin可见
        return this.is_public || this.created_by === userId || userRole === 'admin';
    }

    /**
     * 检查用户是否可以使用此预设
     */
    canUse(userId, userRole) {
        return this.canView(userId, userRole);
    }

    /**
     * 创建系统默认预设
     */
    static getDefaultPresets() {
        const now = new Date().toISOString();
        
        return [
            new Preset({
                preset_name: '平坦',
                preset_category: '标准',
                profile: {
                    volume: 0.5,
                    eq: [0, 0, 0, 0, 0],
                    reverb: 0.3
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: '平衡的音频设置，适合大多数内容',
                created_at: now,
                updated_at: now
            }),
            new Preset({
                preset_name: '摇滚',
                preset_category: '音乐',
                profile: {
                    volume: 0.65,
                    eq: [3, 2, -1, 2, 4],
                    reverb: 0.4
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: '增强低频和高频，适合摇滚音乐',
                created_at: now,
                updated_at: now
            }),
            new Preset({
                preset_name: '流行',
                preset_category: '音乐',
                profile: {
                    volume: 0.6,
                    eq: [-1, 2, 3, 1, 2],
                    reverb: 0.35
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: '突出人声，适合流行音乐',
                created_at: now,
                updated_at: now
            }),
            new Preset({
                preset_name: '古典',
                preset_category: '音乐',
                profile: {
                    volume: 0.55,
                    eq: [0, -2, 0, 2, 1],
                    reverb: 0.5
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: '自然音色，适合古典音乐',
                created_at: now,
                updated_at: now
            }),
            new Preset({
                preset_name: '电影',
                preset_category: '娱乐',
                profile: {
                    volume: 0.7,
                    eq: [2, 0, -1, 3, 2],
                    reverb: 0.6
                },
                created_by: 'system',
                creator_role: 'admin',
                is_public: true,
                description: '增强动态范围，适合电影音频',
                created_at: now,
                updated_at: now
            })
        ];
    }

    /**
     * 根据分类筛选预设
     */
    static filterByCategory(presets, category) {
        if (!category || category === 'all') {
            return presets;
        }
        return presets.filter(preset => preset.preset_category === category);
    }

    /**
     * 获取预设使用统计摘要
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