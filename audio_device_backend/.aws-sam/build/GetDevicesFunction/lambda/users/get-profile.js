/**
 * 获取用户信息接口
 * GET /api/users/profile
 * GET /api/users/{user_id}
 * 
 * 根据JWT token或用户ID获取用户信息
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const User = require('../../shared/models/user');

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const userInfo = getUserInfo(event);
        const { user_id } = event.pathParameters || {};

        // 如果是获取特定用户信息
        if (user_id) {
            return await getUserById(user_id, userInfo);
        }

        // 如果是获取当前用户信息 (通过 JWT)
        if (userInfo.userId && userInfo.userId !== 'anonymous') {
            return await getCurrentUserProfile(userInfo);
        }

        return createResponse(401, {
            error: '未认证',
            message: '请先登录'
        });

    } catch (error) {
        console.error('获取用户信息失败:', error);
        return createResponse(500, {
            error: '获取用户信息失败',
            details: error.message
        });
    }
};

/**
 * 根据用户ID获取用户信息
 */
async function getUserById(userId, requestUser) {
    try {
        const user = await dynamoDb.send(new GetCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            }
        }));

        if (!user.Item) {
            return createResponse(404, {
                error: '用户不存在'
            });
        }

        const userObj = User.fromDynamoItem(user.Item);
        
        // 判断是否返回完整信息还是公开信息
        const isOwnProfile = requestUser.userId === userId;
        const isAdmin = requestUser.userRole === 'admin';
        const includePrivate = isOwnProfile || isAdmin;

        return createResponse(200, {
            success: true,
            data: {
                user: userObj.toApiResponse(includePrivate),
                isOwn: isOwnProfile
            }
        });

    } catch (error) {
        console.error('获取用户信息失败:', error);
        throw error;
    }
}

/**
 * 获取当前登录用户的完整信息
 */
async function getCurrentUserProfile(userInfo) {
    try {
        // 通过 Cognito ID 或用户ID 获取用户信息
        let user;
        
        if (userInfo.userId) {
            // 直接通过用户ID获取
            const result = await dynamoDb.send(new GetCommand({
                TableName: process.env.AUDIO_MANAGEMENT_TABLE,
                Key: {
                    PK: `USER#${userInfo.userId}`,
                    SK: 'PROFILE'
                }
            }));
            
            if (result.Item) {
                user = User.fromDynamoItem(result.Item);
            }
        }

        if (!user && userInfo.username) {
            // 尝试通过邮箱查找
            const result = await dynamoDb.send(new QueryCommand({
                TableName: process.env.AUDIO_MANAGEMENT_TABLE,
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :email',
                ExpressionAttributeValues: {
                    ':email': `EMAIL#${userInfo.username}`
                }
            }));

            if (result.Items && result.Items.length > 0) {
                user = User.fromDynamoItem(result.Items[0]);
            }
        }

        if (!user) {
            return createResponse(404, {
                error: '用户记录不存在',
                message: '用户信息未找到，可能需要重新注册'
            });
        }

        // 获取用户的设备和预设统计
        const stats = await getUserStats(user.user_id);

        // 更新用户统计信息
        if (stats.devices_count !== user.stats.devices_count || 
            stats.presets_count !== user.stats.presets_count) {
            await updateUserStats(user.user_id, stats);
            user.updateStats(stats);
        }

        return createResponse(200, {
            success: true,
            data: {
                user: user.toApiResponse(true), // 完整信息
                stats: stats,
                permissions: {
                    isAdmin: user.isAdmin(),
                    canCreatePublicPresets: user.isAdmin(),
                    canManageUsers: user.isAdmin()
                },
                lastActivity: {
                    lastLogin: user.stats.last_login,
                    loginCount: user.stats.login_count,
                    lastActiveAt: user.last_active_at
                }
            }
        });

    } catch (error) {
        console.error('获取当前用户信息失败:', error);
        throw error;
    }
}

/**
 * 获取用户统计信息
 */
async function getUserStats(userId) {
    try {
        // 查询用户的设备数量
        const devicesResult = await dynamoDb.send(new QueryCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :userKey',
            ExpressionAttributeValues: {
                ':userKey': `USER#${userId}`
            },
            Select: 'COUNT'
        }));

        // 查询用户创建的预设数量
        const presetsResult = await dynamoDb.send(new QueryCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            FilterExpression: 'created_by = :userId AND begins_with(SK, :presetPrefix)',
            ExpressionAttributeValues: {
                ':userId': userId,
                ':presetPrefix': 'PRESET#'
            },
            Select: 'COUNT'
        }));

        return {
            devices_count: devicesResult.Count || 0,
            presets_count: presetsResult.Count || 0
        };

    } catch (error) {
        console.error('获取用户统计失败:', error);
        return {
            devices_count: 0,
            presets_count: 0
        };
    }
}

/**
 * 更新用户统计信息
 */
async function updateUserStats(userId, stats) {
    try {
        const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
        
        await dynamoDb.send(new UpdateCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            },
            UpdateExpression: 'SET stats.devices_count = :devices, stats.presets_count = :presets, updated_at = :updated',
            ExpressionAttributeValues: {
                ':devices': stats.devices_count,
                ':presets': stats.presets_count,
                ':updated': new Date().toISOString()
            }
        }));

    } catch (error) {
        console.error('更新用户统计失败:', error);
    }
}

/**
 * 从事件中提取用户信息
 */
function getUserInfo(event) {
    const claims = event.requestContext?.authorizer?.claims || {};
    return {
        userId: claims.sub || 'anonymous',
        username: claims['cognito:username'] || claims.email || 'anonymous',
        userRole: claims['custom:role'] || 'user',
        groups: claims['cognito:groups'] ? claims['cognito:groups'].split(',') : []
    };
}

/**
 * 创建标准化响应
 */
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify(body)
    };
}