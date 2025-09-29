/**
 * Comprehensive user management script - provisions Cognito users and syncs data to DynamoDB
 */

const {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    AdminUpdateUserAttributesCommand,
    AdminSetUserPasswordCommand
} = require('@aws-sdk/client-cognito-identity-provider');
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
 * Create a fully populated user (Cognito + DynamoDB + demo devices/presets)
 */
async function createCompleteUser(email, name, role = 'user') {
    try {
        console.log(`\n🚀 Creating full user: ${email} (${role})`);

        // 1. Create Cognito user
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
        console.log(`  ✅ Cognito user created: ${cognitoUsername}`);

        // 2. Add the user to the appropriate group
        await cognitoClient.send(new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: cognitoUsername,
            GroupName: role
        }));
        console.log(`  ✅ Added to ${role} group`);

        // 3. Set a permanent password
        const finalPassword = role === 'admin' ? 'AdminPass123!' : 'UserPass123!';
        await cognitoClient.send(new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: cognitoUsername,
            Password: finalPassword,
            Permanent: true
        }));
        console.log('  ✅ Password configured');

        // 4. Create DynamoDB user record
        const userData = {
            cognito_id: cognitoUsername,
            email,
            username: email.split('@')[0],
            full_name: name,
            role,
            email_verified: true,
            status: 'active',
            profile: {
                bio: role === 'admin' ? 'System administrator account' : `${name}\'s profile`,
                location: role === 'admin' ? 'System' : 'Demo City'
            }
        };

        const user = new User(userData);

        await dynamoDb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: user.toDynamoItem()
        }));
        console.log(`  ✅ DynamoDB user record created: ${user.user_id}`);

        // 5. Provision demo devices
        const deviceCount = role === 'admin' ? 2 : 1;
        const devices = [];

        for (let i = 1; i <= deviceCount; i++) {
            const deviceName = role === 'admin'
                ? `Admin Device ${i}`
                : `${name}\'s Device`;

            const device = await createDemoDevice(user.user_id, email, deviceName);
            devices.push(device);
            console.log(`  ✅ Device created: ${device.device_name}`);

            // Create demo presets for each device
            await createDemoPresets(device.device_id, user.user_id, role, 3);
        }

        // 6. Update user statistics
        await updateUserStats(user.user_id, {
            devices_count: devices.length,
            presets_count: devices.length * 3
        });

        return {
            cognitoId: cognitoUsername,
            userId: user.user_id,
            email,
            role,
            password: finalPassword,
            devices: devices.length,
            presets: devices.length * 3
        };
    } catch (error) {
        if (error.name === 'UsernameExistsException' || error.message.includes('User account already exists')) {
            console.log(`⚠️  User ${email} already exists. Attempting to ensure DynamoDB records and devices are in place...`);

            try {
                // Attempt to recreate DynamoDB record for the existing user
                const userData = {
                    cognito_id: email, // assume the Cognito username equals the email
                    email,
                    username: email.split('@')[0],
                    full_name: name,
                    role,
                    email_verified: true,
                    status: 'active',
                    profile: {
                        avatar_url: null,
                        bio: `${name}\'s profile`,
                        location: 'Demo City',
                        phone: null
                    },
                    preferences: {
                        language: 'en-US',
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

                // Check if the user already exists in DynamoDB
                try {
                    const existingUser = await dynamoDb.send(new GetCommand({
                        TableName: TABLE_NAME,
                        Key: {
                            PK: `USER#${user.user_id}`,
                            SK: 'PROFILE'
                        }
                    }));

                    if (existingUser.Item) {
                        console.log('  ✅ DynamoDB user record already exists');
                        return null;
                    }
                } catch (getError) {
                    // User not found, continue to create records
                }

                // Create DynamoDB record
                await dynamoDb.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: user.toDynamoItem()
                }));
                console.log(`  ✅ DynamoDB user record created: ${user.user_id}`);

                // Provision demo devices
                const deviceCount = role === 'admin' ? 2 : 1;
                const devices = [];

                for (let i = 1; i <= deviceCount; i++) {
                    const deviceName = role === 'admin'
                        ? `Admin Device ${i}`
                        : `${name}\'s Device`;

                    const device = await createDemoDevice(user.user_id, email, deviceName);
                    devices.push(device);
                    console.log(`  ✅ Device created: ${device.device_name}`);

                    await createDemoPresets(device.device_id, user.user_id, role, 3);
                }

                await updateUserStats(user.user_id, {
                    devices_count: devices.length,
                    presets_count: devices.length * 3
                });

                const finalPassword = role === 'admin' ? 'AdminPass123!' : 'UserPass123!';
                return {
                    cognitoId: email,
                    userId: user.user_id,
                    email,
                    role,
                    password: finalPassword,
                    devices: devices.length,
                    presets: devices.length * 3
                };
            } catch (dbError) {
                console.error(`❌ Failed to create DynamoDB record: ${dbError.message}`);
                return null;
            }
        } else {
            console.error(`❌ Failed to create user: ${error.message}`);
            throw error;
        }
    }
}

/**
 * Create a sample device for the user
 */
async function createDemoDevice(userId, email, deviceName) {
    const deviceData = {
        device_name: deviceName,
        device_model: 'Demo Audio Device v2.0',
        owner_id: userId,
        owner_email: email,
        is_online: Math.random() > 0.3, // 70% online
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
 * Create demo presets for a device
 */
async function createDemoPresets(deviceId, userId, userRole, count = 3) {
    const presetNames = ['Pop Boost', 'Rock Stage', 'Classical Hall', 'Electronic Pulse', 'Smooth Jazz'];
    const categories = ['music', 'gaming', 'movie', 'voice', 'custom'];

    for (let i = 0; i < count && i < presetNames.length; i++) {
        const presetData = {
            preset_name: presetNames[i],
            preset_category: categories[i % categories.length],
            device_id: deviceId,
            created_by: userId,
            creator_role: userRole,
            is_public: userRole === 'admin' ? Math.random() > 0.5 : false,
            description: `${presetNames[i]} audio configuration`,
            profile: {
                volume: 0.3 + Math.random() * 0.4,
                eq_settings: Array.from({ length: 5 }, () => Math.floor(Math.random() * 7) - 3),
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
 * Update basic user statistics
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
 * Create a set of demo users
 */
async function createDemoUsers() {
    console.log('🚀 Starting demo user provisioning...\n');

    const demoUsers = [
        {
            email: 'admin@demo.com',
            name: 'System Administrator',
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

                console.log(`\n📋 User ${userData.email} provisioned:`);
                console.log(`   - Email: ${result.email}`);
                console.log(`   - Role: ${result.role}`);
                console.log(`   - Password: ${result.password}`);
                console.log(`   - Devices: ${result.devices}`);
                console.log(`   - Presets: ${result.presets}`);
                console.log('-----------------------------------');
            } else {
                console.log(`\n⚠️  User ${userData.email} already exists. Skipping.`);
            }
        } catch (error) {
            if (error.name === 'UsernameExistsException') {
                console.log(`⚠️  User ${userData.email} already exists. Skipping.`);
            } else {
                console.error(`❌ Failed to create user ${userData.email}:`, error.message);
            }
        }
    }

    return results;
}

/**
 * Display user statistics from DynamoDB
 */
async function showUserStats() {
    console.log('\n📊 User statistics:');
    console.log('='.repeat(50));

    try {
        const result = await dynamoDb.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'EntityType = :userType',
            ExpressionAttributeValues: {
                ':userType': 'User'
            }
        }));

        if (result.Items && result.Items.length > 0) {
            console.log(`\nFound ${result.Items.length} users:`);

            result.Items.forEach(item => {
                const user = User.fromDynamoItem(item);
                console.log(`\n👤 ${user.full_name} (${user.email})`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Status: ${user.status}`);
                console.log(`   Devices: ${user.stats.devices_count}`);
                console.log(`   Presets: ${user.stats.presets_count}`);
                console.log(`   Created: ${user.created_at}`);
            });
        } else {
            console.log('\n📭 No user records found');
        }

        const totalStats = await getTotalStats();
        console.log('\n📈 Totals:');
        console.log(`   Users: ${totalStats.users}`);
        console.log(`   Devices: ${totalStats.devices}`);
        console.log(`   Presets: ${totalStats.presets}`);
        console.log(`   Admins: ${totalStats.admins}`);
        console.log(`   Standard users: ${totalStats.regularUsers}`);
    } catch (error) {
        console.error('❌ Failed to retrieve user statistics:', error.message);
    }
}

/**
 * Aggregate overall statistics
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
 * Entry point
 */
async function main() {
    const command = process.argv[2] || 'create';

    switch (command) {
        case 'create': {
            const results = await createDemoUsers();
            console.log('\n🎉 Demo users provisioned successfully!');
            console.log('\n📋 Summary:');
            console.log('='.repeat(50));
            results.forEach(result => {
                if (result) {
                    console.log(`✅ ${result.email} - ${result.role} - ${result.password}`);
                }
            });
            break;
        }

        case 'stats':
            await showUserStats();
            break;

        default:
            console.log(`
🎯 User management script usage:

Commands:
  create  - Provision demo users (including devices and presets)
  stats   - Display user statistics from DynamoDB

Examples:
  node scripts/manage-users-complete.js create
  node scripts/manage-users-complete.js stats
            `);
    }
}

// Execute when run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    createCompleteUser,
    createDemoUsers,
    showUserStats
};
