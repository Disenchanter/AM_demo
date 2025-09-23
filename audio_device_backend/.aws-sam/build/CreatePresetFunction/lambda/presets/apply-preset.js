/**
 * 将预设应用到设备（更新设备状态）
 * POST /api/devices/{device_id}/apply-preset
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const Device = require('../../shared/models/device');
const Preset = require('../../shared/models/preset');

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const { device_id } = event.pathParameters || {};
        const userInfo = getUserInfo(event);
        const body = JSON.parse(event.body || '{}');
        const { preset_id } = body;

        if (!device_id) {
            return createResponse(400, { error: '设备ID不能为空' });
        }

        if (!preset_id) {
            return createResponse(400, { error: '预设ID不能为空' });
        }

        // 检查设备是否存在且用户有权限操作
        const deviceResult = await getDevice(device_id);
        if (!deviceResult.device) {
            return createResponse(404, { error: '设备不存在' });
        }

        const device = deviceResult.device;
        if (!canOperateDevice(device, userInfo)) {
            return createResponse(403, { error: '没有权限操作此设备' });
        }

        // 获取预设信息
        const presetResult = await getPreset(preset_id);
        if (!presetResult.preset) {
            return createResponse(404, { error: '预设不存在' });
        }

        const preset = presetResult.preset;
        
        // 检查预设是否适用于该设备
        if (preset.device_id !== device_id) {
            return createResponse(400, { error: '预设不适用于此设备' });
        }

        // 检查用户是否可以查看该预设
        if (!preset.canView(userInfo.userId, userInfo.userRole)) {
            return createResponse(403, { error: '没有权限使用此预设' });
        }

        // 应用预设到设备（更新设备状态）
        const updatedDevice = device.applyPreset({
            volume: preset.volume,
            eq_settings: preset.eq_settings,
            reverb: preset.reverb
        });

        // 保存更新的设备状态 - 使用单表设计
        const updateParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: { 
                PK: `DEVICE#${device_id}`,
                SK: 'DEVICE'
            },
            UpdateExpression: 'SET current_volume = :volume, current_eq = :eq, current_reverb = :reverb, updated_at = :updated_at',
            ExpressionAttributeValues: {
                ':volume': updatedDevice.current_volume,
                ':eq': updatedDevice.current_eq,
                ':reverb': updatedDevice.current_reverb,
                ':updated_at': updatedDevice.updated_at
            },
            ReturnValues: 'ALL_NEW'
        };

        console.log('DynamoDB Update Params:', JSON.stringify(updateParams));

        const updateResult = await dynamoDb.send(new UpdateCommand(updateParams));
        const finalDevice = Device.fromDynamoItem(updateResult.Attributes);

        // 记录应用日志（可选，用于统计预设使用情况）
        await logPresetUsage(device_id, preset_id, userInfo);

        return createResponse(200, {
            success: true,
            message: '预设应用成功',
            data: {
                device: finalDevice.toApiResponse(),
                appliedPreset: {
                    id: preset.preset_id,
                    name: preset.preset_name,
                    appliedAt: new Date().toISOString()
                }
            }
        });

    } catch (error) {
        console.error('Error:', error);
        return createResponse(500, { 
            error: '应用预设失败',
            details: error.message 
        });
    }
};

/**
 * 获取设备信息 - 使用单表设计
 */
async function getDevice(deviceId) {
    try {
        const getParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: { 
                PK: `DEVICE#${deviceId}`,
                SK: 'DEVICE'
            }
        };

        const result = await dynamoDb.send(new GetCommand(getParams));
        return {
            device: result.Item ? Device.fromDynamoItem(result.Item) : null
        };

    } catch (error) {
        console.error('获取设备信息失败:', error);
        return { device: null };
    }
}

/**
 * 获取预设信息 - 使用单表设计
 */
async function getPreset(presetId) {
    try {
        const getParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: { 
                PK: `PRESET#${presetId}`,
                SK: 'PRESET'
            }
        };

        const result = await dynamoDb.send(new GetCommand(getParams));
        return {
            preset: result.Item ? Preset.fromDynamoItem(result.Item) : null
        };

    } catch (error) {
        console.error('获取预设信息失败:', error);
        return { preset: null };
    }
}

/**
 * 检查用户是否可以操作设备
 */
function canOperateDevice(device, userInfo) {
    // Admin可以操作所有设备，普通用户只能操作自己的设备
    return userInfo.userRole === 'admin' || device.owner_id === userInfo.userId;
}

/**
 * 记录预设使用日志
 */
async function logPresetUsage(deviceId, presetId, userInfo) {
    try {
        // 这里可以记录到单独的使用统计表，用于分析预设受欢迎程度
        const logParams = {
            TableName: process.env.USAGE_LOGS_TABLE || 'UsageLogs', // 可选的使用日志表
            Item: {
                log_id: `${deviceId}_${presetId}_${Date.now()}`,
                device_id: deviceId,
                preset_id: presetId,
                user_id: userInfo.userId,
                action: 'apply_preset',
                timestamp: new Date().toISOString()
            }
        };

        // 如果使用日志表不存在，跳过记录
        if (process.env.USAGE_LOGS_TABLE) {
            await dynamoDb.send(new PutCommand(logParams));
        }

    } catch (error) {
        // 记录日志失败不应影响主流程
        console.warn('记录使用日志失败:', error.message);
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