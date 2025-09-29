/**
 * User registration endpoint
 * POST /api/auth/register
 *
 * Flow overview:
 * 1. Create the user in Cognito
 * 2. Persist a user record in DynamoDB
 * 3. Provision a default demo device and preset metadata
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminUpdateUserAttributesCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const User = require('../../shared/models/user');
const Device = require('../../shared/models/device');

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const body = JSON.parse(event.body || '{}');
        const {
            email,
            password,
            fullName,
            username,
            role = 'user'
        } = body;

        // Validate required inputs
        if (!email || !password || !fullName) {
            return createResponse(400, {
                error: 'Missing required fields',
                message: 'Email, password, and full name are all required'
            });
        }

        // Enforce email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return createResponse(400, {
                error: 'Invalid email format'
            });
        }

        // Basic password length requirement
        if (password.length < 8) {
            return createResponse(400, {
                error: 'Password must be at least 8 characters long'
            });
        }

        // Guard against duplicate records in DynamoDB
        const existingUser = await checkUserExists(email);
        if (existingUser) {
            return createResponse(409, {
                error: 'User already exists',
                message: 'This email address is already registered'
            });
        }

        // 1. Create the user in Cognito
        const cognitoUser = await createCognitoUser(email, password, fullName, role);
        console.log('Cognito user created:', cognitoUser.User.Username);

        // 2. Build the user domain model
        const userData = {
            cognito_id: cognitoUser.User.Username,
            email: email,
            username: username || email.split('@')[0],
            full_name: fullName,
            role: role,
            email_verified: false,
            status: 'active'
        };

        const user = new User(userData);

        // Validate user payload
        const validation = user.validate();
        if (!validation.isValid) {
            // Roll back Cognito user when validation fails
            await deleteCognitoUser(cognitoUser.User.Username);
            return createResponse(400, {
                error: 'User data validation failed',
                details: validation.errors
            });
        }

        // 3. Persist the user to DynamoDB
        await dynamoDb.send(new PutCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Item: user.toDynamoItem(),
            ConditionExpression: 'attribute_not_exists(PK)'
        }));

        // 4. Provision a demo device for the new user
        await createDemoDeviceForUser(user.user_id, email);

        // 5. Initialize the user stats counters
        await updateUserStats(user.user_id, { devices_count: 1 });

        console.log('User registration completed:', user.user_id);

        return createResponse(201, {
            success: true,
            message: 'Registration successful',
            data: {
                user: user.toApiResponse(),
                cognitoId: cognitoUser.User.Username
            }
        });

    } catch (error) {
        console.error('Registration failed:', error);

        if (error.name === 'UsernameExistsException') {
            return createResponse(409, {
                error: 'User already exists',
                message: 'This email address is already registered'
            });
        }

        if (error.name === 'ConditionalCheckFailedException') {
            return createResponse(409, {
                error: 'User already exists',
                message: 'User record already exists'
            });
        }

        return createResponse(500, {
            error: 'Registration failed',
            details: error.message
        });
    }
};

/**
 * Check whether a user record already exists
 */
async function checkUserExists(email) {
    try {
        const result = await dynamoDb.send(new GetCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            IndexName: 'GSI1',
            Key: {
                GSI1PK: `EMAIL#${email}`,
                GSI1SK: 'USER'
            }
        }));
        return result.Item;
    } catch (error) {
        console.log('Error during user existence check:', error);
        return null;
    }
}

/**
 * Create the Cognito user entry
 */
async function createCognitoUser(email, password, fullName, role) {
    const params = {
        UserPoolId: process.env.USER_POOL_ID || 'us-east-1_JC02HU4kc',
        Username: email,
        UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'name', Value: fullName },
            { Name: 'custom:role', Value: role }
        ],
        TemporaryPassword: password,
        MessageAction: 'SUPPRESS'
    };

    const cognitoUser = await cognitoClient.send(new AdminCreateUserCommand(params));

    // Add the user to the proper group
    await cognitoClient.send(new AdminAddUserToGroupCommand({
        UserPoolId: process.env.USER_POOL_ID || 'us-east-1_JC02HU4kc',
        Username: cognitoUser.User.Username,
        GroupName: role
    }));

    // Configure a permanent password
    await cognitoClient.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.USER_POOL_ID || 'us-east-1_JC02HU4kc',
        Username: cognitoUser.User.Username,
        Password: password,
        Permanent: true
    }));

    return cognitoUser;
}

/**
 * Remove the Cognito user (rollback helper)
 */
async function deleteCognitoUser(username) {
    try {
        const { AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
        await cognitoClient.send(new AdminDeleteUserCommand({
            UserPoolId: process.env.USER_POOL_ID || 'us-east-1_JC02HU4kc',
            Username: username
        }));
    } catch (error) {
        console.error('Failed to delete Cognito user:', error);
    }
}

/**
 * Create a demo device for brand new users
 */
async function createDemoDeviceForUser(userId, email) {
    const deviceData = {
        device_name: `${email.split('@')[0]}'s device`,
        device_model: 'Demo Audio Device v1.0',
        owner_id: userId,
        owner_email: email,
        is_online: true
    };

    const device = new Device(deviceData);
    
    await dynamoDb.send(new PutCommand({
        TableName: process.env.AUDIO_MANAGEMENT_TABLE,
        Item: device.toDynamoItem()
    }));

    console.log('Created demo device for user:', device.device_id);
    return device;
}

/**
 * Initialize or update user statistics
 */
async function updateUserStats(userId, stats) {
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
    
    await dynamoDb.send(new UpdateCommand({
        TableName: process.env.AUDIO_MANAGEMENT_TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE'
        },
        UpdateExpression: 'SET stats = :stats, updated_at = :updated_at',
        ExpressionAttributeValues: {
            ':stats': stats,
            ':updated_at': new Date().toISOString()
        }
    }));
}

/**
 * Build a normalized HTTP response
 */
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify(body)
    };
}