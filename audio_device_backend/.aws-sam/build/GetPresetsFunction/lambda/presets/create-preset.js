/**
 * 创建新的音频预设
 * POST /api/presets
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const Preset = require('../../shared/models/preset');

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const userInfo = getUserInfo(event);
        const body = JSON.parse(event.body || '{}');

        console.log('Create preset request body:', JSON.stringify(body));

        // 验证必需字段
        if (!body.name || body.name.trim() === '') {
            return createResponse(400, { error: '预设名称不能为空' });
        }

        if (typeof body.volume !== 'number' || body.volume < 0 || body.volume > 1) {
            return createResponse(400, { error: '音量值必须在0到1之间' });
        }

        if (typeof body.reverb !== 'number' || body.reverb < 0 || body.reverb > 1) {
            return createResponse(400, { error: '混响值必须在0到1之间' });
        }

        if (!Array.isArray(body.eq) || body.eq.length !== 5) {
            return createResponse(400, { error: 'EQ设置必须包含5个频段' });
        }

        // 验证EQ值
        for (let i = 0; i < body.eq.length; i++) {
            if (typeof body.eq[i] !== 'number' || body.eq[i] < -12 || body.eq[i] > 12) {
                return createResponse(400, { error: `EQ频段${i + 1}值必须在-12到12之间` });
            }
        }

        // 创建预设实例 - 不依赖设备
        const presetData = {
            preset_name: body.name.trim(),
            description: body.description?.trim() || '',
            profile: {
                volume: body.volume,
                eq: body.eq,
                reverb: body.reverb
            },
            created_by: userInfo.userId,
            creator_role: userInfo.userRole,
            is_public: body.is_public ?? false,  // 默认为私有预设
            category: body.category || 'custom'
        };

        // 验证用户是否有权限创建公开预设
        if (presetData.is_public && userInfo.userRole !== 'admin') {
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

        // 检查预设名称是否已存在（用户下不能重名）
        const existingPreset = await findPresetByUserAndName(userInfo.userId, preset.preset_name);
        if (existingPreset) {
            return createResponse(409, { error: '您已创建过同名预设' });
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
 * 查找用户的同名预设 - 使用单表设计
 */
async function findPresetByUserAndName(userId, presetName) {
    try {
        const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
        const queryParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :userKey',
            FilterExpression: 'preset_name = :preset_name',
            ExpressionAttributeValues: {
                ':userKey': `USER#${userId}`,
                ':preset_name': presetName
            },
            Limit: 1
        };

        const result = await dynamoDb.send(new QueryCommand(queryParams));
        return result.Items && result.Items.length > 0 ? result.Items[0] : null;

    } catch (error) {
        console.error('查找用户预设失败:', error);
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