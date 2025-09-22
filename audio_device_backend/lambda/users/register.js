/**
 * 用户注册接口
 * POST /api/auth/register
 * 
 * 处理用户注册流程：
 * 1. 在 Cognito 中创建用户
 * 2. 在 DynamoDB 中创建用户记录
 * 3. 创建默认设备和预设
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

        // 验证必填字段
        if (!email || !password || !fullName) {
            return createResponse(400, {
                error: '缺少必填字段',
                message: '邮箱、密码和姓名都是必填的'
            });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return createResponse(400, {
                error: '邮箱格式无效'
            });
        }

        // 验证密码强度
        if (password.length < 8) {
            return createResponse(400, {
                error: '密码长度至少8位'
            });
        }

        // 检查用户是否已存在于 DynamoDB
        const existingUser = await checkUserExists(email);
        if (existingUser) {
            return createResponse(409, {
                error: '用户已存在',
                message: '该邮箱已被注册'
            });
        }

        // 1. 在 Cognito 中创建用户
        const cognitoUser = await createCognitoUser(email, password, fullName, role);
        console.log('Cognito用户创建成功:', cognitoUser.User.Username);

        // 2. 创建用户数据模型
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

        // 验证用户数据
        const validation = user.validate();
        if (!validation.isValid) {
            // 如果用户数据无效，删除 Cognito 用户
            await deleteCognitoUser(cognitoUser.User.Username);
            return createResponse(400, {
                error: '用户数据验证失败',
                details: validation.errors
            });
        }

        // 3. 保存用户到 DynamoDB
        await dynamoDb.send(new PutCommand({
            TableName: process.env.AUDIO_MANAGEMENT_TABLE,
            Item: user.toDynamoItem(),
            ConditionExpression: 'attribute_not_exists(PK)'
        }));

        // 4. 为新用户创建一个示例设备（Demo用）
        await createDemoDeviceForUser(user.user_id, email);

        // 5. 更新用户统计
        await updateUserStats(user.user_id, { devices_count: 1 });

        console.log('用户注册成功:', user.user_id);

        return createResponse(201, {
            success: true,
            message: '注册成功',
            data: {
                user: user.toApiResponse(),
                cognitoId: cognitoUser.User.Username
            }
        });

    } catch (error) {
        console.error('注册失败:', error);

        if (error.name === 'UsernameExistsException') {
            return createResponse(409, {
                error: '用户已存在',
                message: '该邮箱已被注册'
            });
        }

        if (error.name === 'ConditionalCheckFailedException') {
            return createResponse(409, {
                error: '用户已存在',
                message: '用户记录已存在'
            });
        }

        return createResponse(500, {
            error: '注册失败',
            details: error.message
        });
    }
};

/**
 * 检查用户是否已存在
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
        console.log('检查用户存在性时出错:', error);
        return null;
    }
}

/**
 * 在 Cognito 中创建用户
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

    // 添加到用户组
    await cognitoClient.send(new AdminAddUserToGroupCommand({
        UserPoolId: process.env.USER_POOL_ID || 'us-east-1_JC02HU4kc',
        Username: cognitoUser.User.Username,
        GroupName: role
    }));

    // 设置永久密码
    await cognitoClient.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.USER_POOL_ID || 'us-east-1_JC02HU4kc',
        Username: cognitoUser.User.Username,
        Password: password,
        Permanent: true
    }));

    return cognitoUser;
}

/**
 * 删除 Cognito 用户（回滚用）
 */
async function deleteCognitoUser(username) {
    try {
        const { AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
        await cognitoClient.send(new AdminDeleteUserCommand({
            UserPoolId: process.env.USER_POOL_ID || 'us-east-1_JC02HU4kc',
            Username: username
        }));
    } catch (error) {
        console.error('删除Cognito用户失败:', error);
    }
}

/**
 * 为新用户创建示例设备
 */
async function createDemoDeviceForUser(userId, email) {
    const deviceData = {
        device_name: `${email.split('@')[0]} 的设备`,
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

    console.log('为用户创建示例设备:', device.device_id);
    return device;
}

/**
 * 更新用户统计信息
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