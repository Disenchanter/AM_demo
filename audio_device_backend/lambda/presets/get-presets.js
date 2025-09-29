/**
 * Fetch presets accessible to the requesting user.
 * GET /api/presets or GET /api/devices/{device_id}/presets
 *
 * Access rules:
 * - Admins can view every preset
 * - Standard users can view their own presets plus any public presets
 *
 * When a device_id is supplied, results are scoped to that device.
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

        // device_id is optional; default to all accessible presets
        let presets = [];

        // Fetch presets according to the shared access rules
        presets = await getPresetsForUser(device_id, userInfo.userId, userInfo.userRole);

        // Normalize the Dynamo items to API responses and sort
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
            error: 'Failed to fetch preset list',
            details: error.message 
        });
    }
};

/**
 * Retrieve every preset and filter it by access rules.
 */
async function getPresetsForUser(deviceId, userId, userRole) {
    // Scan for every preset entity in the table
    const scanParams = {
        TableName: process.env.AUDIO_MANAGEMENT_TABLE,
        FilterExpression: 'EntityType = :entityType',
        ExpressionAttributeValues: {
            ':entityType': 'Preset'
        }
    };

    const result = await dynamoDb.send(new ScanCommand(scanParams));
    const allPresets = result.Items || [];

    // Apply authorization checks for the requesting user
    const accessiblePresets = allPresets.filter(preset => {
        // When a device filter is provided, limit to matching presets
        if (deviceId && preset.device_id && preset.device_id !== deviceId) {
            return false;
        }

        // Administrators can see everything
        if (userRole === 'admin') {
            return true;
        }

        // Standard user rules:
        // 1. They can see any preset they created (public or private)
        if (preset.created_by === userId) {
            return true;
        }

        // 2. They can see all public presets
        if (preset.is_public === true) {
            return true;
        }

        // Otherwise access is denied
        return false;
    });

    return accessiblePresets;
}

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