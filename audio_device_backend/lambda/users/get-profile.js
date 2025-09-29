/**
 * User profile endpoints
 * GET /api/users/profile
 * GET /api/users/{user_id}
 *
 * Retrieve profile data by JWT claims or explicit user ID.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const User = require('../../shared/models/user');

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const userInfo = getUserInfo(event);
        const { user_id } = event.pathParameters || {};

        // Fetch a specific user when an explicit ID is provided
        if (user_id) {
            return await getUserById(user_id, userInfo);
        }

        // Otherwise resolve the currently authenticated user via JWT
        if (userInfo.userId && userInfo.userId !== 'anonymous') {
            return await getCurrentUserProfile(userInfo);
        }

        return createResponse(401, {
            error: 'Unauthorized',
            message: 'Please sign in first'
        });

    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        return createResponse(500, {
            error: 'Failed to fetch user profile',
            details: error.message
        });
    }
};

/**
 * Look up a user profile by user ID.
 */
async function getUserById(userId, requestUser) {
    try {
        const user = await dynamoDb.send(new GetCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            }
        }));

        if (!user.Item) {
            return createResponse(404, {
                error: 'User not found'
            });
        }

        const userObj = User.fromDynamoItem(user.Item);
        
        // Decide whether to include private fields
        const isOwnProfile = requestUser.userId === userId;
        const isAdmin = requestUser.userRole === 'admin';
        const includePrivate = isOwnProfile || isAdmin;

        return createResponse(200, {
            success: true,
            data: {
                user: userObj.toApiResponse(includePrivate),
                isOwn: isOwnProfile
            }
        });

    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        throw error;
    }
}

/**
 * Retrieve the full profile for the authenticated user.
 */
async function getCurrentUserProfile(userInfo) {
    try {
        // Resolve by Cognito user ID or fallback identifiers
        let user;
        
        if (userInfo.userId) {
            // Primary lookup by user ID
            const result = await dynamoDb.send(new GetCommand({
                TableName: process.env.AUDIO_MANAGEMENT_TABLE,
                Key: {
                    PK: `USER#${userInfo.userId}`,
                    SK: 'PROFILE'
                }
            }));
            
            if (result.Item) {
                user = User.fromDynamoItem(result.Item);
            }
        }

        if (!user && userInfo.username) {
            // Fallback lookup by email address via GSI
            const result = await dynamoDb.send(new QueryCommand({
                TableName: process.env.AUDIO_MANAGEMENT_TABLE,
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :email',
                ExpressionAttributeValues: {
                    ':email': `EMAIL#${userInfo.username}`
                }
            }));

            if (result.Items && result.Items.length > 0) {
                user = User.fromDynamoItem(result.Items[0]);
            }
        }

        if (!user) {
            return createResponse(404, {
                error: 'User record not found',
                message: 'We could not locate your account. Please try signing up again.'
            });
        }

        // Gather device and preset statistics for the user
        const stats = await getUserStats(user.user_id);

        // Synchronize stored statistics if they drift from latest counts
        if (stats.devices_count !== user.stats.devices_count || 
            stats.presets_count !== user.stats.presets_count) {
            await updateUserStats(user.user_id, stats);
            user.updateStats(stats);
        }

        return createResponse(200, {
            success: true,
            data: {
                user: user.toApiResponse(true), // Include private fields for the owner
                stats: stats,
                permissions: {
                    isAdmin: user.isAdmin(),
                    canCreatePublicPresets: user.isAdmin(),
                    canManageUsers: user.isAdmin()
                },
                lastActivity: {
                    lastLogin: user.stats.last_login,
                    loginCount: user.stats.login_count,
                    lastActiveAt: user.last_active_at
                }
            }
        });

    } catch (error) {
        console.error('Failed to fetch current user profile:', error);
        throw error;
    }
}

/**
 * Aggregate user statistics (device count and preset count).
 */
async function getUserStats(userId) {
    try {
        // Count devices owned by the user
        const devicesResult = await dynamoDb.send(new QueryCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :userKey',
            ExpressionAttributeValues: {
                ':userKey': `USER#${userId}`
            },
            Select: 'COUNT'
        }));

        // Count presets created by the user
        const presetsResult = await dynamoDb.send(new QueryCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            FilterExpression: 'created_by = :userId AND begins_with(SK, :presetPrefix)',
            ExpressionAttributeValues: {
                ':userId': userId,
                ':presetPrefix': 'PRESET#'
            },
            Select: 'COUNT'
        }));

        return {
            devices_count: devicesResult.Count || 0,
            presets_count: presetsResult.Count || 0
        };

    } catch (error) {
        console.error('Failed to aggregate user statistics:', error);
        return {
            devices_count: 0,
            presets_count: 0
        };
    }
}

/**
 * Persist updated user statistics in DynamoDB.
 */
async function updateUserStats(userId, stats) {
    try {
        const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
        
        await dynamoDb.send(new UpdateCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            },
            UpdateExpression: 'SET stats.devices_count = :devices, stats.presets_count = :presets, updated_at = :updated',
            ExpressionAttributeValues: {
                ':devices': stats.devices_count,
                ':presets': stats.presets_count,
                ':updated': new Date().toISOString()
            }
        }));

    } catch (error) {
        console.error('Failed to update user statistics:', error);
    }
}

/**
 * Extract relevant user metadata from the API Gateway event.
 */
function getUserInfo(event) {
    const claims = event.requestContext?.authorizer?.claims || {};
    return {
        userId: claims.sub || 'anonymous',
        username: claims['cognito:username'] || claims.email || 'anonymous',
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
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify(body)
    };
}