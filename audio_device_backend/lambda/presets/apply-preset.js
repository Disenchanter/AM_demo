/**
 * Apply a preset to a device (updates device state).
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
            return createResponse(400, { error: 'Device ID is required' });
        }

        if (!preset_id) {
            return createResponse(400, { error: 'Preset ID is required' });
        }

        // Ensure the device exists and the user can operate it
        const deviceResult = await getDevice(device_id);
        if (!deviceResult.device) {
            return createResponse(404, { error: 'Device not found' });
        }

        const device = deviceResult.device;
        if (!canOperateDevice(device, userInfo)) {
            return createResponse(403, { error: 'Not authorized to operate this device' });
        }

        // Fetch the preset details
        const presetResult = await getPreset(preset_id);
        if (!presetResult.preset) {
            return createResponse(404, { error: 'Preset not found' });
        }

        const preset = presetResult.preset;
        
        // Ensure the preset belongs to the device
        if (preset.device_id !== device_id) {
            return createResponse(400, { error: 'Preset does not apply to this device' });
        }

        // Ensure the user has permission to use the preset
        if (!preset.canView(userInfo.userId, userInfo.userRole)) {
            return createResponse(403, { error: 'Not authorized to use this preset' });
        }

        // Apply the preset to the device
        const updatedDevice = device.applyPreset({
            volume: preset.volume,
            eq_settings: preset.eq_settings,
            reverb: preset.reverb
        });

        // Persist the updated device state (single-table design)
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

        // Record usage logs (optional analytics)
        await logPresetUsage(device_id, preset_id, userInfo);

        return createResponse(200, {
            success: true,
            message: 'Preset applied successfully',
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
            error: 'Failed to apply preset',
            details: error.message 
        });
    }
};

/**
 * Retrieve a device record (single-table design).
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
        console.error('Failed to retrieve device:', error);
        return { device: null };
    }
}

/**
 * Retrieve a preset record (single-table design).
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
        console.error('Failed to retrieve preset:', error);
        return { preset: null };
    }
}

/**
 * Determine whether the user can operate the device.
 */
function canOperateDevice(device, userInfo) {
    // Admins can operate any device; users can only operate their own devices
    return userInfo.userRole === 'admin' || device.owner_id === userInfo.userId;
}

/**
 * Record preset usage analytics.
 */
async function logPresetUsage(deviceId, presetId, userInfo) {
    try {
        // Optionally write to a dedicated analytics table for popularity tracking
        const logParams = {
            TableName: process.env.USAGE_LOGS_TABLE || 'UsageLogs', // Optional usage log table
            Item: {
                log_id: `${deviceId}_${presetId}_${Date.now()}`,
                device_id: deviceId,
                preset_id: presetId,
                user_id: userInfo.userId,
                action: 'apply_preset',
                timestamp: new Date().toISOString()
            }
        };

        // Skip recording if the usage log table is not configured
        if (process.env.USAGE_LOGS_TABLE) {
            await dynamoDb.send(new PutCommand(logParams));
        }

    } catch (error) {
        // Failing to log usage should not block the main flow
        console.warn('Failed to record usage log:', error.message);
    }
}

/**
 * Extract user information from the request event.
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
 * Build a consistent HTTP response structure.
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