/**
 * User login endpoint
 * POST /api/auth/login
 *
 * Flow overview:
 * 1. Authenticate credentials with Cognito
 * 2. Update the user's activity timestamp in DynamoDB
 * 3. Return user details plus issued tokens
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, InitiateAuthCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const User = require('../../shared/models/user');

const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event, context) => {
    try {
        console.log('Event:', JSON.stringify(event));

        const body = JSON.parse(event.body || '{}');
        const { email, password } = body;

        // Validate required fields
        if (!email || !password) {
            return createResponse(400, {
                error: 'Missing required fields',
                message: 'Email and password are both required'
            });
        }

        // 1. Authenticate credentials with Cognito
        const authResult = await authenticateUser(email, password);
        
        if (!authResult.success) {
            return createResponse(401, {
                error: 'Login failed',
                message: authResult.message || 'Email or password is incorrect'
            });
        }

        // 2. Retrieve user attributes from Cognito
        const cognitoUser = await getCognitoUserDetails(authResult.username);
        
        // 3. Fetch or initialize the user record in DynamoDB
        let user = await getUserFromDatabase(email);
        
        if (!user) {
            // Create a new record using Cognito metadata when none exists
            user = await createUserFromCognitoData(cognitoUser);
        } else {
            // Refresh last-active timestamps and login counters
            await updateUserActivity(user.user_id);
            user = await getUserFromDatabase(email); // Reload with updated stats
        }

        console.log('User login succeeded:', user.user_id);

        return createResponse(200, {
            success: true,
            message: 'Login successful',
            data: {
                user: user.toApiResponse(true), // includes private profile fields
                tokens: {
                    accessToken: authResult.tokens.AccessToken,
                    idToken: authResult.tokens.IdToken,
                    refreshToken: authResult.tokens.RefreshToken,
                    expiresIn: authResult.tokens.ExpiresIn
                },
                sessionInfo: {
                    loginTime: new Date().toISOString(),
                    userAgent: event.headers['User-Agent'] || 'Unknown',
                    ip: event.requestContext?.identity?.sourceIp || 'Unknown'
                }
            }
        });

    } catch (error) {
        console.error('Login failed:', error);

        // Map cognition-specific errors to user-friendly responses
        if (error.name === 'NotAuthorizedException') {
            return createResponse(401, {
                error: 'Login failed',
                message: 'Email or password is incorrect'
            });
        }

        if (error.name === 'UserNotFoundException') {
            return createResponse(404, {
                error: 'User not found',
                message: 'This email has not been registered yet'
            });
        }

        if (error.name === 'UserNotConfirmedException') {
            return createResponse(403, {
                error: 'Account not activated',
                message: 'Please verify your email first'
            });
        }

        if (error.name === 'PasswordResetRequiredException') {
            return createResponse(403, {
                error: 'Password reset required',
                message: 'Please reset your password'
            });
        }

        return createResponse(500, {
            error: 'Login failed',
            details: error.message
        });
    }
};

/**
 * Authenticate user credentials via Cognito
 */
async function authenticateUser(email, password) {
    try {
        const params = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.USER_POOL_CLIENT_ID || '7bftlfh7a3uflvi8k1rjbb4ooe',
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        };

        const response = await cognitoClient.send(new InitiateAuthCommand(params));
        
        return {
            success: true,
            tokens: response.AuthenticationResult,
            username: response.ChallengeParameters?.USERNAME || email
        };

    } catch (error) {
        console.error('Cognito authentication failed:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Fetch detailed Cognito attributes for the user
 */
async function getCognitoUserDetails(username) {
    const params = {
        UserPoolId: process.env.USER_POOL_ID || 'us-east-1_JC02HU4kc',
        Username: username
    };

    const response = await cognitoClient.send(new AdminGetUserCommand(params));
    return response;
}

/**
 * Retrieve a user record from DynamoDB
 */
async function getUserFromDatabase(email) {
    try {
        const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
        
        const result = await dynamoDb.send(new QueryCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :email',
            ExpressionAttributeValues: {
                ':email': `EMAIL#${email}`
            }
        }));

        if (result.Items && result.Items.length > 0) {
            return User.fromDynamoItem(result.Items[0]);
        }
        
        return null;
    } catch (error) {
        console.error('Failed to fetch user data:', error);
        return null;
    }
}

/**
 * Create a user record based on Cognito payload
 */
async function createUserFromCognitoData(cognitoUser) {
    const email = cognitoUser.UserAttributes.find(attr => attr.Name === 'email')?.Value;
    const name = cognitoUser.UserAttributes.find(attr => attr.Name === 'name')?.Value;
    const role = cognitoUser.UserAttributes.find(attr => attr.Name === 'custom:role')?.Value || 'user';

    const userData = {
        cognito_id: cognitoUser.Username,
        email: email,
        username: email.split('@')[0],
        full_name: name || '',
        role: role,
        email_verified: cognitoUser.UserStatus === 'CONFIRMED',
        status: 'active'
    };

    const user = new User(userData);
    
    // Persist to DynamoDB
    await dynamoDb.send(new PutCommand({
        TableName: process.env.AUDIO_MANAGEMENT_TABLE,
        Item: user.toDynamoItem()
    }));

    return user;
}

/**
 * Update last-active timestamps and login stats
 */
async function updateUserActivity(userId) {
    const now = new Date().toISOString();
    
    try {
        // Load existing stats snapshot
        const currentUser = await dynamoDb.send(new GetCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            }
        }));

        const currentStats = currentUser.Item?.stats || {};
        const updatedStats = {
            ...currentStats,
            last_login: now,
            login_count: (currentStats.login_count || 0) + 1
        };

        await dynamoDb.send(new UpdateCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            },
            UpdateExpression: 'SET last_active_at = :active_at, stats = :stats, updated_at = :updated_at',
            ExpressionAttributeValues: {
                ':active_at': now,
                ':stats': updatedStats,
                ':updated_at': now
            }
        }));

        console.log('User activity timestamp updated:', userId);
    } catch (error) {
        console.error('Failed to update user activity timestamp:', error);
        // Do not throw because this is a non-critical operation
    }
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