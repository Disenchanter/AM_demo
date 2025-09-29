/**
 * Retrieve the device list accessible to the current user.
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

    // Build query parameters using the single-table pattern
        let queryParams;
        
        if (userInfo.userRole === 'admin') {
            // Admins can inspect every device by scanning DEVICE# items
            queryParams = {
                TableName: process.env.AUDIO_MANAGEMENT_TABLE,
                FilterExpression: 'begins_with(PK, :devicePrefix)',
                ExpressionAttributeValues: {
                    ':devicePrefix': 'DEVICE#'
                }
            };
        } else {
            // Standard users can only see their own devices via GSI1
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

    // Execute the appropriate read based on role
        let result;
        if (userInfo.userRole === 'admin') {
            result = await dynamoDb.send(new ScanCommand(queryParams));
        } else {
            result = await dynamoDb.send(new QueryCommand(queryParams));
        }

    // Normalize to Device models, shape for API, and sort by recency
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
            error: 'Failed to fetch device list',
            details: error.message 
        });
    }
};

/**
 * Extract identity details from the API Gateway event.
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
 * Helper to build consistent API Gateway responses.
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