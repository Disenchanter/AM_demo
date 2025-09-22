/**
 * 创建新的设备预设
 * POST /api/devices/{device_id}/presets
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const Preset = require('../../shared/models/preset');

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const { device_id } = event.pathParameters || {};
        const userInfo = getUserInfo(event);
        const body = JSON.parse(event.body || '{}');

        if (!device_id) {
            return createResponse(400, { error: '设备ID不能为空' });
        }

        // 检查设备是否存在且用户有权限管理
        const devicePermission = await checkDevicePermission(device_id, userInfo);
        if (!devicePermission.allowed) {
            return createResponse(devicePermission.statusCode, { error: devicePermission.message });
        }

        // 创建预设实例
        const presetData = {
            preset_name: body.name || body.preset_name,
            device_id: device_id,
            volume: body.volume,
            eq_settings: body.eq || body.eq_settings,
            reverb: body.reverb,
            created_by: userInfo.userId,
            creator_role: userInfo.userRole,
            is_public: body.is_public ?? false  // 默认为私有预设
        };

        // 验证用户是否有权限创建公开预设
        if (presetData.is_public && !Preset.canCreatePublicPreset(userInfo.userRole, presetData.is_public)) {
            return createResponse(403, { 
                error: '权限不足', 
                message: '只有管理员可以创建公开预设' 
            });
        }

        const preset = new Preset(presetData);

        // 验证预设数据
        const validation = preset.validate();
        if (!validation.isValid) {
            return createResponse(400, { 
                error: '预设数据验证失败', 
                details: validation.errors 
            });
        }

        // 检查预设名称是否已存在（同设备下不能重名）
        const existingPreset = await findPresetByName(device_id, preset.preset_name);
        if (existingPreset) {
            return createResponse(409, { error: '该设备下已存在同名预设' });
        }

        // 保存到DynamoDB - 使用单表设计
        const putParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Item: preset.toDynamoItem(),
            ConditionExpression: 'attribute_not_exists(preset_id)'
        };

        console.log('DynamoDB Put Params:', JSON.stringify(putParams));

        await dynamoDb.send(new PutCommand(putParams));

        return createResponse(201, {
            success: true,
            message: '预设创建成功',
            data: preset.toApiResponse()
        });

    } catch (error) {
        console.error('Error:', error);
        
        if (error.code === 'ConditionalCheckFailedException') {
            return createResponse(409, { error: '预设ID已存在' });
        }

        return createResponse(500, { 
            error: '创建预设失败',
            details: error.message 
        });
    }
};

/**
 * 检查设备权限 - 使用单表设计
 */
async function checkDevicePermission(deviceId, userInfo) {
    try {
        const getParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: { 
                PK: `DEVICE#${deviceId}`,
                SK: 'METADATA'
            }
        };

        const result = await dynamoDb.send(new GetCommand(getParams));
        
        if (!result.Item) {
            return { allowed: false, statusCode: 404, message: '设备不存在' };
        }

        // Admin可以为任何设备创建预设，普通用户只能为自己的设备创建预设
        if (userInfo.userRole === 'admin' || result.Item.owner_id === userInfo.userId) {
            return { allowed: true };
        } else {
            return { allowed: false, statusCode: 403, message: '没有权限为此设备创建预设' };
        }

    } catch (error) {
        console.error('设备权限检查失败:', error);
        return { allowed: false, statusCode: 500, message: '设备权限检查失败' };
    }
}

/**
 * 查找同名预设 - 使用单表设计
 */
async function findPresetByName(deviceId, presetName) {
    try {
        const queryParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :deviceKey',
            FilterExpression: 'preset_name = :preset_name',
            ExpressionAttributeValues: {
                ':deviceKey': `DEVICE#${deviceId}`,
                ':preset_name': presetName
            },
            Limit: 1
        };

        const result = await dynamoDb.send(new QueryCommand(queryParams));
        return result.Items && result.Items.length > 0 ? result.Items[0] : null;

    } catch (error) {
        console.error('查找预设失败:', error);
        return null;
    }
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