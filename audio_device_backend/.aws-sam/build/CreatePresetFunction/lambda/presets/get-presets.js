/**
 * 获取用户可访问的预设列表
 * GET /api/presets 或 GET /api/devices/{device_id}/presets
 * 
 * 权限规则：
 * - 管理员：可以查看所有预设
 * - 普通用户：只能查看自己创建的预设 + 所有公开预设
 * 
 * 如果提供了device_id参数，则只返回该设备相关的预设
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const Preset = require('../../shared/models/preset');

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const { device_id } = event.pathParameters || {};
        const userInfo = getUserInfo(event);

        // device_id是可选的，如果不提供则返回所有可访问的预设
        let presets = [];

        // 使用统一的函数获取用户可访问的预设
        presets = await getPresetsForUser(device_id, userInfo.userId, userInfo.userRole);

        // 转换为API响应格式并排序
        const responsePresets = presets
            .map(item => Preset.fromDynamoItem(item))
            .map(preset => preset.toApiResponse())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return createResponse(200, {
            success: true,
            data: {
                deviceId: device_id,
                presets: responsePresets,
                count: responsePresets.length,
                userRole: userInfo.userRole
            }
        });

    } catch (error) {
        console.error('Error:', error);
        return createResponse(500, { 
            error: '获取预设列表失败',
            details: error.message 
        });
    }
};

/**
 * 获取所有预设，然后根据用户角色和权限进行过滤
 */
async function getPresetsForUser(deviceId, userId, userRole) {
    // 扫描所有预设
    const scanParams = {
        TableName: process.env.AUDIO_MANAGEMENT_TABLE,
        FilterExpression: 'EntityType = :entityType',
        ExpressionAttributeValues: {
            ':entityType': 'Preset'
        }
    };

    const result = await dynamoDb.send(new ScanCommand(scanParams));
    const allPresets = result.Items || [];

    // 根据用户角色和权限过滤预设
    const accessiblePresets = allPresets.filter(preset => {
        // 如果指定了设备ID，只返回该设备的预设
        if (deviceId && preset.device_id && preset.device_id !== deviceId) {
            return false;
        }

        // 管理员可以查看所有预设
        if (userRole === 'admin') {
            return true;
        }

        // 普通用户的权限规则：
        // 1. 可以查看自己创建的所有预设（公开和私人）
        if (preset.created_by === userId) {
            return true;
        }

        // 2. 可以查看所有公开预设
        if (preset.is_public === true) {
            return true;
        }

        // 其他情况不允许访问
        return false;
    });

    return accessiblePresets;
}

/**
 * 从事件中提取用户信息
 */
function getUserInfo(event) {
    const claims = event.requestContext?.authorizer?.claims || {};
    return {
        userId: claims.sub || 'anonymous',
        username: claims['cognito:username'] || 'anonymous',
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
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify(body)
    };
}