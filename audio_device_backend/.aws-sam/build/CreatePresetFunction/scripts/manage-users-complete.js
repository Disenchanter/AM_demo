/**
 * 完整用户管理脚本 - 创建和管理 Cognito 用户，并同步到 DynamoDB
 */

const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminUpdateUserAttributesCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const User = require('../shared/models/user');
const Device = require('../shared/models/device');
const Preset = require('../shared/models/preset');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);

const USER_POOL_ID = 'us-east-1_JC02HU4kc';
const TABLE_NAME = 'AudioManagement-dev';

/**
 * 创建完整用户（Cognito + DynamoDB + 示例设备）
 */
async function createCompleteUser(email, name, role = 'user') {
    try {
        console.log(`\n🚀 创建完整用户: ${email} (${role})`);
        
        // 1. 创建 Cognito 用户
        const tempPassword = 'TempPass123!';
        const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'name', Value: name },
                { Name: 'custom:role', Value: role }
            ],
            TemporaryPassword: tempPassword,
            MessageAction: 'SUPPRESS'
        });

        const cognitoResult = await cognitoClient.send(createUserCommand);
        const cognitoUsername = cognitoResult.User.Username;
        console.log(`  ✅ Cognito用户创建: ${cognitoUsername}`);

        // 2. 添加到用户组
        await cognitoClient.send(new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: cognitoUsername,
            GroupName: role
        }));
        console.log(`  ✅ 已添加到 ${role} 组`);

        // 3. 设置永久密码
        const finalPassword = role === 'admin' ? 'AdminPass123!' : 'UserPass123!';
        await cognitoClient.send(new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: cognitoUsername,
            Password: finalPassword,
            Permanent: true
        }));
        console.log(`  ✅ 密码设置完成`);

        // 4. 创建 DynamoDB 用户记录
        const userData = {
            cognito_id: cognitoUsername,
            email: email,
            username: email.split('@')[0],
            full_name: name,
            role: role,
            email_verified: true,
            status: 'active',
            profile: {
                bio: role === 'admin' ? '系统管理员' : `${name} 的个人简介`,
                location: role === 'admin' ? 'System' : '演示城市'
            }
        };

        const user = new User(userData);
        
        await dynamoDb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: user.toDynamoItem()
        }));
        console.log(`  ✅ DynamoDB用户记录: ${user.user_id}`);

        // 5. 创建示例设备
        const deviceCount = role === 'admin' ? 2 : 1;
        const devices = [];
        
        for (let i = 1; i <= deviceCount; i++) {
            const deviceName = role === 'admin' 
                ? `管理员设备 ${i}` 
                : `${name} 的设备`;
            
            const device = await createDemoDevice(user.user_id, email, deviceName);
            devices.push(device);
            console.log(`  ✅ 设备创建: ${device.device_name}`);
            
            // 为每个设备创建预设
            await createDemoPresets(device.device_id, user.user_id, role, 3);
        }

        // 6. 更新用户统计
        await updateUserStats(user.user_id, {
            devices_count: devices.length,
            presets_count: devices.length * 3
        });

        return {
            cognitoId: cognitoUsername,
            userId: user.user_id,
            email: email,
            role: role,
            password: finalPassword,
            devices: devices.length,
            presets: devices.length * 3
        };

    } catch (error) {
        if (error.name === 'UsernameExistsException' || error.message.includes('User account already exists')) {
            console.log(`⚠️ 用户 ${email} 已存在，尝试创建DynamoDB记录和设备...`);
            
            try {
                // 获取现有用户信息并创建DynamoDB记录
                const userData = {
                    cognito_id: email, // 假设用户名就是email
                    email: email,
                    username: email.split('@')[0],
                    full_name: name,
                    role: role,
                    email_verified: true,
                    status: 'active',
                    profile: {
                        avatar_url: null,
                        bio: null,
                        location: null,
                        phone: null
                    },
                    preferences: {
                        language: 'zh-CN',
                        theme: 'light',
                        notifications: {
                            email: true,
                            push: true,
                            sms: false
                        },
                        audio: {
                            default_volume: 75,
                            equalizer_preset: 'balanced',
                            auto_connect: true
                        }
                    }
                };

                const user = new User(userData);

                // 检查用户是否已在DynamoDB中存在
                try {
                    const existingUser = await dynamoDb.send(new GetCommand({
                        TableName: TABLE_NAME,
                        Key: {
                            PK: `USER#${user.user_id}`,
                            SK: 'PROFILE'
                        }
                    }));

                    if (existingUser.Item) {
                        console.log(`  ✅ DynamoDB中已存在用户记录`);
                        return null; // 用户和记录都已存在
                    }
                } catch (getError) {
                    // 用户不存在，继续创建
                }

                // 创建DynamoDB记录
                await dynamoDb.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: user.toDynamoItem()
                }));
                console.log(`  ✅ DynamoDB用户记录: ${user.user_id}`);

                // 创建示例设备
                const deviceCount = role === 'admin' ? 2 : 1;
                const devices = [];
                
                for (let i = 1; i <= deviceCount; i++) {
                    const deviceName = role === 'admin' 
                        ? `管理员设备 ${i}` 
                        : `${name} 的设备`;
                    
                    const device = await createDemoDevice(user.user_id, email, deviceName);
                    devices.push(device);
                    console.log(`  ✅ 设备创建: ${device.device_name}`);
                    
                    // 为每个设备创建预设
                    await createDemoPresets(device.device_id, user.user_id, role, 3);
                }

                // 更新用户统计
                await updateUserStats(user.user_id, {
                    devices_count: devices.length,
                    presets_count: devices.length * 3
                });

                const finalPassword = role === 'admin' ? 'AdminPass123!' : 'UserPass123!';
                return {
                    cognitoId: email,
                    userId: user.user_id,
                    email: email,
                    role: role,
                    password: finalPassword,
                    devices: devices.length,
                    presets: devices.length * 3
                };

            } catch (dbError) {
                console.error(`❌ 创建DynamoDB记录失败: ${dbError.message}`);
                return null;
            }
        } else {
            console.error(`❌ 创建用户失败: ${error.message}`);
            throw error;
        }
    }
}

/**
 * 创建示例设备
 */
async function createDemoDevice(userId, email, deviceName) {
    const deviceData = {
        device_name: deviceName,
        device_model: 'Demo Audio Device v2.0',
        owner_id: userId,
        owner_email: email,
        is_online: Math.random() > 0.3, // 70% 在线
        last_seen: new Date().toISOString()
    };

    const device = new Device(deviceData);
    
    await dynamoDb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: device.toDynamoItem()
    }));

    return device;
}

/**
 * 为设备创建示例预设
 */
async function createDemoPresets(deviceId, userId, userRole, count = 3) {
    const presetNames = ['流行音乐', '摇滚音乐', '古典音乐', '电子音乐', '爵士音乐'];
    const categories = ['music', 'gaming', 'movie', 'voice', 'custom'];
    
    for (let i = 0; i < count && i < presetNames.length; i++) {
        const presetData = {
            preset_name: presetNames[i],
            preset_category: categories[i % categories.length],
            device_id: deviceId,
            created_by: userId,
            creator_role: userRole,
            is_public: userRole === 'admin' ? Math.random() > 0.5 : false, // 管理员50%公开
            description: `${presetNames[i]}专用音频配置`,
            // 随机音频设置
            profile: {
                volume: 0.3 + Math.random() * 0.4, // 0.3-0.7
                eq_settings: Array.from({length: 5}, () => Math.floor(Math.random() * 7) - 3), // -3到+3
                reverb: Math.random() * 0.5,
                bass_boost: Math.random() * 0.3,
                treble_boost: Math.random() * 0.3
            }
        };

        const preset = new Preset(presetData);
        
        await dynamoDb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: preset.toDynamoItem()
        }));
    }
}

/**
 * 更新用户统计信息
 */
async function updateUserStats(userId, stats) {
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
    
    await dynamoDb.send(new UpdateCommand({
        TableName: TABLE_NAME,
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
 * 批量创建演示用户
 */
async function createDemoUsers() {
    console.log('🚀 开始创建演示用户...\n');

    const demoUsers = [
        {
            email: 'admin@demo.com',
            name: '系统管理员',
            role: 'admin'
        },
        {
            email: 'alice@demo.com',
            name: 'Alice Johnson',
            role: 'user'
        },
        {
            email: 'bob@demo.com',
            name: 'Bob Smith',
            role: 'user'
        },
        {
            email: 'carol@demo.com',
            name: 'Carol Davis',
            role: 'user'
        }
    ];

    const results = [];

    for (const userData of demoUsers) {
        try {
            const result = await createCompleteUser(
                userData.email,
                userData.name,
                userData.role
            );
            
            if (result) {
                results.push(result);
                
                console.log(`\n📋 用户 ${userData.email} 创建完成:`);
                console.log(`   - 邮箱: ${result.email}`);
                console.log(`   - 角色: ${result.role}`);
                console.log(`   - 密码: ${result.password}`);
                console.log(`   - 设备: ${result.devices} 个`);
                console.log(`   - 预设: ${result.presets} 个`);
                console.log('-----------------------------------');
            } else {
                console.log(`\n⚠️ 用户 ${userData.email} 已完全存在，跳过创建`);
            }

        } catch (error) {
            if (error.name === 'UsernameExistsException') {
                console.log(`⚠️ 用户 ${userData.email} 已存在，跳过创建`);
            } else {
                console.error(`❌ 创建用户 ${userData.email} 失败:`, error.message);
            }
        }
    }

    return results;
}

/**
 * 显示所有用户统计
 */
async function showUserStats() {
    console.log('\n📊 用户数据统计:');
    console.log('='.repeat(50));

    try {
        // 扫描所有用户
        const result = await dynamoDb.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'EntityType = :userType',
            ExpressionAttributeValues: {
                ':userType': 'User'
            }
        }));

        if (result.Items && result.Items.length > 0) {
            console.log(`\n找到 ${result.Items.length} 个用户:`);
            
            result.Items.forEach(item => {
                const user = User.fromDynamoItem(item);
                console.log(`\n👤 ${user.full_name} (${user.email})`);
                console.log(`   角色: ${user.role}`);
                console.log(`   状态: ${user.status}`);
                console.log(`   设备: ${user.stats.devices_count} 个`);
                console.log(`   预设: ${user.stats.presets_count} 个`);
                console.log(`   创建时间: ${user.created_at}`);
            });
        } else {
            console.log('\n📭 没有找到用户记录');
        }

        // 显示总体统计
        const totalStats = await getTotalStats();
        console.log(`\n📈 总体统计:`);
        console.log(`   用户总数: ${totalStats.users}`);
        console.log(`   设备总数: ${totalStats.devices}`);
        console.log(`   预设总数: ${totalStats.presets}`);
        console.log(`   管理员数: ${totalStats.admins}`);
        console.log(`   普通用户: ${totalStats.regularUsers}`);

    } catch (error) {
        console.error('❌ 获取用户统计失败:', error.message);
    }
}

/**
 * 获取总体统计信息
 */
async function getTotalStats() {
    const result = await dynamoDb.send(new ScanCommand({
        TableName: TABLE_NAME
    }));

    const stats = {
        users: 0,
        devices: 0,
        presets: 0,
        admins: 0,
        regularUsers: 0
    };

    if (result.Items) {
        result.Items.forEach(item => {
            if (item.EntityType === 'User') {
                stats.users++;
                if (item.role === 'admin') {
                    stats.admins++;
                } else {
                    stats.regularUsers++;
                }
            } else if (item.EntityType === 'Device') {
                stats.devices++;
            } else if (item.EntityType === 'Preset') {
                stats.presets++;
            }
        });
    }

    return stats;
}

/**
 * 主函数
 */
async function main() {
    const command = process.argv[2] || 'create';

    switch (command) {
        case 'create':
            const results = await createDemoUsers();
            console.log(`\n🎉 演示用户创建完成！`);
            console.log(`\n📋 创建结果:`);
            console.log('='.repeat(50));
            results.forEach(result => {
                if (result) {
                    console.log(`✅ ${result.email} - ${result.role} - ${result.password}`);
                }
            });
            break;

        case 'stats':
            await showUserStats();
            break;

        default:
            console.log(`
🎯 用户管理脚本使用方法:

命令:
  create  - 创建演示用户（包含设备和预设）
  stats   - 显示用户统计信息

使用示例:
  node scripts/manage-users-complete.js create
  node scripts/manage-users-complete.js stats
            `);
    }
}

// 运行脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    createCompleteUser,
    createDemoUsers,
    showUserStats
};