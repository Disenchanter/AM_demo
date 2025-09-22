/**
 * 用户登录接口
 * POST /api/auth/login
 * 
 * 处理用户登录流程：
 * 1. 通过 Cognito 验证用户凭证
 * 2. 更新 DynamoDB 中的用户活跃时间
 * 3. 返回用户信息和令牌
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
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

        // 验证必填字段
        if (!email || !password) {
            return createResponse(400, {
                error: '缺少必填字段',
                message: '邮箱和密码都是必填的'
            });
        }

        // 1. 通过 Cognito 验证用户凭证
        const authResult = await authenticateUser(email, password);
        
        if (!authResult.success) {
            return createResponse(401, {
                error: '登录失败',
                message: authResult.message || '邮箱或密码错误'
            });
        }

        // 2. 从 Cognito 获取用户详细信息
        const cognitoUser = await getCognitoUserDetails(authResult.username);
        
        // 3. 从 DynamoDB 获取或创建用户记录
        let user = await getUserFromDatabase(email);
        
        if (!user) {
            // 如果数据库中没有用户记录，从 Cognito 信息创建一个
            user = await createUserFromCognitoData(cognitoUser);
        } else {
            // 更新用户的最后活跃时间和登录统计
            await updateUserActivity(user.user_id);
            user = await getUserFromDatabase(email); // 重新获取更新后的数据
        }

        console.log('用户登录成功:', user.user_id);

        return createResponse(200, {
            success: true,
            message: '登录成功',
            data: {
                user: user.toApiResponse(true), // 包含私有信息
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
        console.error('登录失败:', error);

        // 根据错误类型返回不同的错误信息
        if (error.name === 'NotAuthorizedException') {
            return createResponse(401, {
                error: '登录失败',
                message: '邮箱或密码错误'
            });
        }

        if (error.name === 'UserNotFoundException') {
            return createResponse(404, {
                error: '用户不存在',
                message: '该邮箱尚未注册'
            });
        }

        if (error.name === 'UserNotConfirmedException') {
            return createResponse(403, {
                error: '账号未激活',
                message: '请先验证您的邮箱'
            });
        }

        if (error.name === 'PasswordResetRequiredException') {
            return createResponse(403, {
                error: '需要重置密码',
                message: '请重置您的密码'
            });
        }

        return createResponse(500, {
            error: '登录失败',
            details: error.message
        });
    }
};

/**
 * 通过 Cognito 验证用户凭证
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
        console.error('Cognito认证失败:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * 获取 Cognito 用户详细信息
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
 * 从数据库获取用户信息
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
        console.error('获取用户数据失败:', error);
        return null;
    }
}

/**
 * 从 Cognito 数据创建用户记录
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
    
    // 保存到数据库
    await dynamoDb.send(new UpdateCommand({
        TableName: process.env.AUDIO_MANAGEMENT_TABLE,
        Item: user.toDynamoItem()
    }));

    return user;
}

/**
 * 更新用户活跃时间和登录统计
 */
async function updateUserActivity(userId) {
    const now = new Date().toISOString();
    
    try {
        // 先获取当前统计信息
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

        console.log('用户活跃时间已更新:', userId);
    } catch (error) {
        console.error('更新用户活跃时间失败:', error);
        // 不抛出错误，因为这不是关键操作
    }
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
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify(body)
    };
}