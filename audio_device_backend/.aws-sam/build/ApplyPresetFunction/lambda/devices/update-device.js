/**
 * 更新设备状态（音量、EQ、混响）
 * PUT /api/devices/{device_id}
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const Device = require('../../shared/models/device');

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

        // 获取设备信息 - 使用单表设计
        const deviceResult = await getDevice(device_id);
        if (!deviceResult.device) {
            return createResponse(404, { error: '设备不存在' });
        }

        const device = deviceResult.device;

        // 检查用户权限
        if (!canOperateDevice(device, userInfo)) {
            return createResponse(403, { error: '没有权限操作此设备' });
        }

        // 准备更新数据 - 更新state对象中的字段
        const updates = {};
        const updateExpressions = [];
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        // 音量更新
        if (typeof body.volume === 'number') {
            if (body.volume < 0 || body.volume > 1) {
                return createResponse(400, { error: '音量值必须在0到1之间' });
            }
            updateExpressions.push('#state.volume = :volume');
            expressionAttributeValues[':volume'] = body.volume;
            expressionAttributeNames['#state'] = 'state';
        }

        // EQ设置更新
        if (Array.isArray(body.eq)) {
            if (body.eq.length !== 5) {
                return createResponse(400, { error: 'EQ设置必须包含5个频段' });
            }
            
            for (let i = 0; i < body.eq.length; i++) {
                if (typeof body.eq[i] !== 'number' || body.eq[i] < -12 || body.eq[i] > 12) {
                    return createResponse(400, { error: `EQ频段${i + 1}值必须在-12到12之间` });
                }
            }
            
            updateExpressions.push('#state.eq = :eq');
            expressionAttributeValues[':eq'] = body.eq;
            expressionAttributeNames['#state'] = 'state';
        }

        // 混响更新
        if (typeof body.reverb === 'number') {
            if (body.reverb < 0 || body.reverb > 1) {
                return createResponse(400, { error: '混响值必须在0到1之间' });
            }
            updateExpressions.push('#state.reverb = :reverb');
            expressionAttributeValues[':reverb'] = body.reverb;
            expressionAttributeNames['#state'] = 'state';
        }

        // 设备名称更新（仅设备拥有者和管理员）
        if (body.deviceName && (device.owner_id === userInfo.userId || userInfo.userRole === 'admin')) {
            if (body.deviceName.length > 50) {
                return createResponse(400, { error: '设备名称不能超过50个字符' });
            }
            updateExpressions.push('device_name = :name');
            expressionAttributeValues[':name'] = body.deviceName;
        }

        if (updateExpressions.length === 0) {
            return createResponse(400, { error: '没有提供有效的更新数据' });
        }

        // 添加更新时间和state同步版本
        updateExpressions.push('updated_at = :updated_at');
        updateExpressions.push('#state.updated_at = :updated_at');
        updateExpressions.push('#state.sync_version = #state.sync_version + :one');
        expressionAttributeValues[':updated_at'] = new Date().toISOString();
        expressionAttributeValues[':one'] = 1;
        expressionAttributeNames['#state'] = 'state';

        // 执行更新 - 使用单表设计的键
        const updateParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: { 
                PK: `DEVICE#${device_id}`,
                SK: 'DEVICE'
            },
            UpdateExpression: 'SET ' + updateExpressions.join(', '),
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: 'ALL_NEW'
        };

        console.log('DynamoDB Update Params:', JSON.stringify(updateParams));

        const result = await dynamoDb.send(new UpdateCommand(updateParams));
        const updatedDevice = Device.fromDynamoItem(result.Attributes);

        return createResponse(200, {
            success: true,
            message: '设备状态更新成功',
            data: updatedDevice.toApiResponse()
        });

    } catch (error) {
        console.error('Error:', error);
        return createResponse(500, { 
            error: '更新设备状态失败',
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
 * 检查用户是否可以操作设备
 */
function canOperateDevice(device, userInfo) {
    // Admin可以操作所有设备，普通用户只能操作自己的设备
    return userInfo.userRole === 'admin' || device.owner_id === userInfo.userId;
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