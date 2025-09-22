/**
 * 获取用户的设备列表
 * GET /api/devices
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const Device = require('../../shared/models/device');

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const userInfo = getUserInfo(event);

        // 构建查询参数 - 使用单表设计
        let queryParams;
        
        if (userInfo.userRole === 'admin') {
            // Admin可以查看所有设备 - 查询所有DEVICE#实体
            queryParams = {
                TableName: process.env.AUDIO_MANAGEMENT_TABLE,
                FilterExpression: 'begins_with(PK, :devicePrefix)',
                ExpressionAttributeValues: {
                    ':devicePrefix': 'DEVICE#'
                }
            };
        } else {
            // 普通用户只能查看自己的设备 - 使用GSI1查询
            queryParams = {
                TableName: process.env.AUDIO_MANAGEMENT_TABLE,
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :ownerKey',
                ExpressionAttributeValues: {
                    ':ownerKey': `USER#${userInfo.userId}`
                }
            };
        }

        console.log('DynamoDB Query Params:', JSON.stringify(queryParams));

        // 执行查询
        let result;
        if (userInfo.userRole === 'admin') {
            result = await dynamoDb.send(new ScanCommand(queryParams));
        } else {
            result = await dynamoDb.send(new QueryCommand(queryParams));
        }

        // 转换为Device对象并格式化响应
        const devices = result.Items
            .map(item => Device.fromDynamoItem(item))
            .map(device => device.toApiResponse())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return createResponse(200, {
            success: true,
            data: {
                devices: devices,
                count: devices.length,
                userRole: userInfo.userRole
            }
        });

    } catch (error) {
        console.error('Error:', error);
        return createResponse(500, { 
            error: '获取设备列表失败',
            details: error.message 
        });
    }
};

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