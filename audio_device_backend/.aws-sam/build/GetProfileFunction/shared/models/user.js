/**
 * 用户数据模型 (统一架构版)
 * 使用DynamoDB单表设计存储用户信息和偏好设置
 */

const { v4: uuidv4 } = require('uuid');

class User {
    constructor(data = {}) {
        this.PK = data.PK || `USER#${data.user_id || uuidv4()}`;
        this.SK = data.SK || 'PROFILE';
        this.EntityType = 'User';
        this.user_id = data.user_id || this.PK.replace('USER#', '');
        this.cognito_id = data.cognito_id || '';
        this.email = data.email || '';
        this.username = data.username || '';
        this.full_name = data.full_name || '';
        this.role = data.role || 'user'; // 'admin' | 'user'
        this.avatar_url = data.avatar_url || '';
        this.phone = data.phone || '';
        this.preferences = {
            theme: data.preferences?.theme || 'dark',
            language: data.preferences?.language || 'zh-CN',
            notifications: {
                email: data.preferences?.notifications?.email ?? true,
                push: data.preferences?.notifications?.push ?? true,
                sound: data.preferences?.notifications?.sound ?? true
            },
            audio: {
                default_volume: data.preferences?.audio?.default_volume ?? 0.7,
                auto_eq: data.preferences?.audio?.auto_eq ?? true,
                preferred_quality: data.preferences?.audio?.preferred_quality || 'high'
            }
        };
        this.profile = {
            bio: data.profile?.bio || '',
            location: data.profile?.location || '',
            website: data.profile?.website || '',
            social_links: {
                twitter: data.profile?.social_links?.twitter || '',
                github: data.profile?.social_links?.github || '',
                linkedin: data.profile?.social_links?.linkedin || ''
            }
        };
        this.stats = {
            devices_count: data.stats?.devices_count || 0,
            presets_count: data.stats?.presets_count || 0,
            last_login: data.stats?.last_login || null,
            login_count: data.stats?.login_count || 0,
            total_session_time: data.stats?.total_session_time || 0
        };
        this.status = data.status || 'active'; // 'active' | 'inactive' | 'suspended'
        this.email_verified = data.email_verified ?? false;
        this.phone_verified = data.phone_verified ?? false;
        this.created_at = data.created_at || new Date().toISOString();
        this.updated_at = data.updated_at || new Date().toISOString();
        this.last_active_at = data.last_active_at || new Date().toISOString();
    }

    /**
     * 验证用户数据有效性
     */
    validate() {
        const errors = [];

        if (!this.email || !this.isValidEmail(this.email)) {
            errors.push('邮箱格式无效');
        }

        if (!this.username || this.username.length < 3) {
            errors.push('用户名至少需要3个字符');
        }

        if (!this.full_name || this.full_name.trim().length === 0) {
            errors.push('姓名不能为空');
        }

        if (!['admin', 'user'].includes(this.role)) {
            errors.push('用户角色必须是admin或user');
        }

        if (!['active', 'inactive', 'suspended'].includes(this.status)) {
            errors.push('用户状态无效');
        }

        // 验证偏好设置
        if (this.preferences.audio.default_volume < 0 || this.preferences.audio.default_volume > 1) {
            errors.push('默认音量必须在0-1之间');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 验证邮箱格式
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * 转换为DynamoDB项目格式
     */
    toDynamoItem() {
        return {
            PK: this.PK,
            SK: this.SK,
            EntityType: this.EntityType,
            user_id: this.user_id,
            cognito_id: this.cognito_id,
            email: this.email,
            username: this.username,
            full_name: this.full_name,
            role: this.role,
            avatar_url: this.avatar_url,
            phone: this.phone,
            preferences: this.preferences,
            profile: this.profile,
            stats: this.stats,
            status: this.status,
            email_verified: this.email_verified,
            phone_verified: this.phone_verified,
            created_at: this.created_at,
            updated_at: this.updated_at,
            last_active_at: this.last_active_at,
            
            // GSI1 用于按邮箱查询
            GSI1PK: `EMAIL#${this.email}`,
            GSI1SK: 'USER',
            
            // GSI2 用于按角色查询
            GSI2PK: `ROLE#${this.role}`,
            GSI2SK: this.user_id
        };
    }

    /**
     * 转换为API响应格式 (公开信息)
     */
    toApiResponse(includePrivate = false) {
        const publicData = {
            id: this.user_id,
            username: this.username,
            fullName: this.full_name,
            role: this.role,
            avatarUrl: this.avatar_url,
            profile: {
                bio: this.profile.bio,
                location: this.profile.location,
                website: this.profile.website,
                socialLinks: this.profile.social_links
            },
            stats: {
                devicesCount: this.stats.devices_count,
                presetsCount: this.stats.presets_count,
                lastLogin: this.stats.last_login
            },
            status: this.status,
            createdAt: this.created_at,
            lastActiveAt: this.last_active_at
        };

        if (includePrivate) {
            publicData.email = this.email;
            publicData.phone = this.phone;
            publicData.preferences = {
                theme: this.preferences.theme,
                language: this.preferences.language,
                notifications: this.preferences.notifications,
                audio: this.preferences.audio
            };
            publicData.emailVerified = this.email_verified;
            publicData.phoneVerified = this.phone_verified;
            publicData.updatedAt = this.updated_at;
        }

        return publicData;
    }

    /**
     * 转换为Flutter前端格式
     */
    toFlutterFormat() {
        return {
            id: this.user_id,
            email: this.email,
            username: this.username,
            fullName: this.full_name,
            role: this.role,
            avatarUrl: this.avatar_url,
            preferences: this.preferences,
            stats: {
                devicesCount: this.stats.devices_count,
                presetsCount: this.stats.presets_count
            },
            status: this.status
        };
    }

    /**
     * 从DynamoDB项目创建用户实例
     */
    static fromDynamoItem(item) {
        return new User({
            PK: item.PK,
            SK: item.SK,
            user_id: item.user_id,
            cognito_id: item.cognito_id,
            email: item.email,
            username: item.username,
            full_name: item.full_name,
            role: item.role,
            avatar_url: item.avatar_url,
            phone: item.phone,
            preferences: item.preferences,
            profile: item.profile,
            stats: item.stats,
            status: item.status,
            email_verified: item.email_verified,
            phone_verified: item.phone_verified,
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_active_at: item.last_active_at
        });
    }

    /**
     * 从 Cognito 信息创建用户
     */
    static fromCognitoUser(cognitoUser, additionalData = {}) {
        const email = cognitoUser.email || cognitoUser.Attributes?.find(attr => attr.Name === 'email')?.Value;
        const name = cognitoUser.name || cognitoUser.Attributes?.find(attr => attr.Name === 'name')?.Value;
        const role = cognitoUser.role || cognitoUser.Attributes?.find(attr => attr.Name === 'custom:role')?.Value || 'user';

        return new User({
            cognito_id: cognitoUser.Username || cognitoUser.sub,
            email: email,
            username: cognitoUser.preferred_username || email?.split('@')[0] || 'user',
            full_name: name || '',
            role: role,
            email_verified: cognitoUser.email_verified || false,
            status: cognitoUser.UserStatus === 'CONFIRMED' ? 'active' : 'inactive',
            ...additionalData
        });
    }

    /**
     * 更新用户信息
     */
    update(updates) {
        const allowedUpdates = [
            'full_name', 'avatar_url', 'phone', 'preferences', 'profile'
        ];

        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                if (field === 'preferences' || field === 'profile') {
                    this[field] = { ...this[field], ...updates[field] };
                } else {
                    this[field] = updates[field];
                }
            }
        });

        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * 更新统计信息
     */
    updateStats(statUpdates) {
        this.stats = { ...this.stats, ...statUpdates };
        this.updated_at = new Date().toISOString();
        return this;
    }

    /**
     * 更新最后活跃时间
     */
    updateLastActive() {
        this.last_active_at = new Date().toISOString();
        this.stats.last_login = new Date().toISOString();
        this.stats.login_count += 1;
        return this;
    }

    /**
     * 检查用户是否是管理员
     */
    isAdmin() {
        return this.role === 'admin';
    }

    /**
     * 检查用户是否激活
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * 生成用户的公开简介
     */
    getPublicProfile() {
        return {
            id: this.user_id,
            username: this.username,
            fullName: this.full_name,
            avatarUrl: this.avatar_url,
            bio: this.profile.bio,
            location: this.profile.location,
            stats: {
                devicesCount: this.stats.devices_count,
                presetsCount: this.stats.presets_count
            },
            joinedAt: this.created_at
        };
    }
}

module.exports = User;