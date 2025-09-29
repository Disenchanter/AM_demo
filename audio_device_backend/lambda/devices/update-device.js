/**
 * Update device state (volume, EQ, reverb)
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
            return createResponse(400, { error: 'Device ID is required' });
        }

        // Fetch device detail using the single-table pattern
        const deviceResult = await getDevice(device_id);
        if (!deviceResult.device) {
            return createResponse(404, { error: 'Device not found' });
        }

        const device = deviceResult.device;

        // Verify the caller has access to this device
        if (!canOperateDevice(device, userInfo)) {
            return createResponse(403, { error: 'You do not have permission to operate this device' });
        }

        // Prepare the SET expression pieces for state updates
        const updates = {};
        const updateExpressions = [];
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        // Volume update
        if (typeof body.volume === 'number') {
            if (body.volume < 0 || body.volume > 1) {
                return createResponse(400, { error: 'Volume must be between 0 and 1' });
            }
            updateExpressions.push('#state.volume = :volume');
            expressionAttributeValues[':volume'] = body.volume;
            expressionAttributeNames['#state'] = 'state';
        }

        // EQ settings update
        if (Array.isArray(body.eq)) {
            if (body.eq.length !== 5) {
                return createResponse(400, { error: 'EQ settings must contain 5 bands' });
            }
            
            for (let i = 0; i < body.eq.length; i++) {
                if (typeof body.eq[i] !== 'number' || body.eq[i] < -12 || body.eq[i] > 12) {
                    return createResponse(400, { error: `EQ band ${i + 1} must be between -12 and 12` });
                }
            }
            
            updateExpressions.push('#state.eq = :eq');
            expressionAttributeValues[':eq'] = body.eq;
            expressionAttributeNames['#state'] = 'state';
        }

        // Reverb update
        if (typeof body.reverb === 'number') {
            if (body.reverb < 0 || body.reverb > 1) {
                return createResponse(400, { error: 'Reverb must be between 0 and 1' });
            }
            updateExpressions.push('#state.reverb = :reverb');
            expressionAttributeValues[':reverb'] = body.reverb;
            expressionAttributeNames['#state'] = 'state';
        }

        // Device name update (only owner or admin)
        if (body.deviceName && (device.owner_id === userInfo.userId || userInfo.userRole === 'admin')) {
            if (body.deviceName.length > 50) {
                return createResponse(400, { error: 'Device name must not exceed 50 characters' });
            }
            updateExpressions.push('device_name = :name');
            expressionAttributeValues[':name'] = body.deviceName;
        }

        if (updateExpressions.length === 0) {
            return createResponse(400, { error: 'No valid fields provided for update' });
        }

        // Always refresh the timestamps and the state sync version
        updateExpressions.push('updated_at = :updated_at');
        updateExpressions.push('#state.updated_at = :updated_at');
        updateExpressions.push('#state.sync_version = #state.sync_version + :one');
        expressionAttributeValues[':updated_at'] = new Date().toISOString();
        expressionAttributeValues[':one'] = 1;
        expressionAttributeNames['#state'] = 'state';

        // Execute the update with the single-table keys
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
            message: 'Device state updated successfully',
            data: updatedDevice.toApiResponse()
        });

    } catch (error) {
        console.error('Error:', error);
        return createResponse(500, { 
            error: 'Failed to update device state',
            details: error.message 
        });
    }
};

/**
 * Fetch device detail using the single-table pattern
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
        console.error('Failed to fetch device:', error);
        return { device: null };
    }
}

/**
 * Check whether the current user can operate the device
 */
function canOperateDevice(device, userInfo) {
    // Admins can operate any device; regular users can only operate their own devices
    return userInfo.userRole === 'admin' || device.owner_id === userInfo.userId;
}

/**
 * Extract user information from the request context
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
 * Create a normalized API response
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