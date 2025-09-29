/**
 * Create a new audio preset.
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

        // Validate required fields
        if (!body.name || body.name.trim() === '') {
            return createResponse(400, { error: 'Preset name is required' });
        }

        if (typeof body.volume !== 'number' || body.volume < 0 || body.volume > 1) {
            return createResponse(400, { error: 'Volume must be between 0 and 1' });
        }

        if (typeof body.reverb !== 'number' || body.reverb < 0 || body.reverb > 1) {
            return createResponse(400, { error: 'Reverb must be between 0 and 1' });
        }

        if (!Array.isArray(body.eq) || body.eq.length !== 5) {
            return createResponse(400, { error: 'EQ settings must contain exactly 5 bands' });
        }

        // Validate each EQ band value
        for (let i = 0; i < body.eq.length; i++) {
            if (typeof body.eq[i] !== 'number' || body.eq[i] < -12 || body.eq[i] > 12) {
                return createResponse(400, { error: `EQ band ${i + 1} must be between -12 and 12` });
            }
        }

        // Build a preset payload (device agnostic)
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
            is_public: body.is_public ?? false,  // default to private preset
            category: body.category || 'custom'
        };

        // Ensure the requester is allowed to publish presets publicly
        if (presetData.is_public && userInfo.userRole !== 'admin') {
            return createResponse(403, { 
                error: 'Insufficient permissions', 
                message: 'Only administrators can create public presets.' 
            });
        }

        const preset = new Preset(presetData);

        // Validate preset details using the shared model
        const validation = preset.validate();
        if (!validation.isValid) {
            return createResponse(400, { 
                error: 'Preset validation failed', 
                details: validation.errors 
            });
        }

        // Ensure the preset name is unique for the owner
        const existingPreset = await findPresetByUserAndName(userInfo.userId, preset.preset_name);
        if (existingPreset) {
            return createResponse(409, { error: 'You already created a preset with this name' });
        }

        // Persist with the single-table DynamoDB design
        const putParams = {
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Item: preset.toDynamoItem(),
            ConditionExpression: 'attribute_not_exists(preset_id)'
        };

        console.log('DynamoDB Put Params:', JSON.stringify(putParams));

        await dynamoDb.send(new PutCommand(putParams));

        return createResponse(201, {
            success: true,
            message: 'Preset created successfully',
            data: preset.toApiResponse()
        });

    } catch (error) {
        console.error('Error:', error);
        
        if (error.code === 'ConditionalCheckFailedException') {
            return createResponse(409, { error: 'Preset ID already exists' });
        }

        return createResponse(500, { 
            error: 'Failed to create preset',
            details: error.message 
        });
    }
};
/**
 * Locate an existing preset with the same name for the given user.
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
        console.error('Failed to query presets for user:', error);
        return null;
    }
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