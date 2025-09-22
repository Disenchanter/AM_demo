/**
 * 数据管理脚本 - 管理 DynamoDB 中的测试数据
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamoDb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'AudioManagement-dev';

/**
 * 创建测试设备
 */
async function createTestDevice(deviceName, ownerEmail, ownerId) {
    const deviceId = uuidv4();
    const now = new Date().toISOString();

    const device = {
        PK: `DEVICE#${deviceId}`,
        SK: 'METADATA',
        EntityType: 'Device',
        device_id: deviceId,
        device_name: deviceName,
        device_model: 'Demo Audio Device v1.0',
        owner_id: ownerId,
        owner_email: ownerEmail,
        state: {
            volume: 0.5,
            eq: [0, 2, -1, 3, 1], // 5频段EQ设置
            reverb: 0.3,
            last_preset_id: null,
            updated_at: now,
            sync_version: 1
        },
        is_online: true,
        last_seen: now,
        created_at: now,
        updated_at: now,
        // GSI1 索引用于按用户查询设备
        GSI1PK: `USER#${ownerId}`,
        GSI1SK: `DEVICE#${deviceId}`
    };

    try {
        await dynamoDb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: device
        }));
        console.log(`✅ 设备创建成功: ${deviceName} (${deviceId})`);
        return device;
    } catch (error) {
        console.error(`❌ 创建设备失败: ${deviceName}`, error.message);
        throw error;
    }
}

/**
 * 创建测试预设
 */
async function createTestPreset(presetName, deviceId, creatorId, creatorRole, isPublic = true) {
    const presetId = uuidv4();
    const now = new Date().toISOString();

    const preset = {
        PK: `PRESET#${presetId}`,
        SK: 'PRESET',
        EntityType: 'Preset',
        preset_id: presetId,
        preset_name: presetName,
        preset_category: 'Music',
        profile: {
            volume: Math.random() * 0.5 + 0.5, // 0.5-1.0
            eq: [
                Math.floor(Math.random() * 24 - 12), // -12 to +12
                Math.floor(Math.random() * 24 - 12),
                Math.floor(Math.random() * 24 - 12),
                Math.floor(Math.random() * 24 - 12),
                Math.floor(Math.random() * 24 - 12)
            ],
            reverb: Math.random() * 0.8 + 0.1, // 0.1-0.9
            last_preset_id: null,
            updated_at: now,
            sync_version: 1
        },
        created_by: creatorId,
        creator_role: creatorRole,
        is_public: isPublic,
        description: `${presetName} 预设，适用于各种音乐类型`,
        usage_count: Math.floor(Math.random() * 100),
        created_at: now,
        updated_at: now,
        // GSI1 索引用于按设备查询预设
        GSI1PK: `DEVICE#${deviceId}`,
        GSI1SK: `PRESET#${presetId}`
    };

    try {
        await dynamoDb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: preset
        }));
        console.log(`✅ 预设创建成功: ${presetName} (${presetId})`);
        return preset;
    } catch (error) {
        console.error(`❌ 创建预设失败: ${presetName}`, error.message);
        throw error;
    }
}

/**
 * 批量创建测试数据
 */
async function createTestData() {
    console.log('🚀 开始创建测试数据...\n');

    // 假设的用户ID（需要从 Cognito 获取）
    const testUsers = [
        {
            id: '24680408-c031-700c-484c-5c2e517641c8', // admin用户
            email: 'admin@demo.com',
            role: 'admin'
        },
        {
            id: 'e4884498-b0b1-7068-f246-db965e5ae407', // user1
            email: 'user1@demo.com', 
            role: 'user'
        },
        {
            id: '340824e8-20a1-70e0-faa1-32cf2c994142', // user2
            email: 'user2@demo.com',
            role: 'user'
        }
    ];

    const createdDevices = [];
    const createdPresets = [];

    // 为每个用户创建设备
    for (const user of testUsers) {
        // 创建1-2个设备
        const deviceCount = user.role === 'admin' ? 2 : 1;
        
        for (let i = 1; i <= deviceCount; i++) {
            const deviceName = user.role === 'admin' 
                ? `管理员设备 ${i}` 
                : `${user.email.split('@')[0]} 的设备`;
            
            try {
                const device = await createTestDevice(deviceName, user.email, user.id);
                createdDevices.push(device);

                // 为每个设备创建预设
                const presetNames = [
                    '流行音乐', '摇滚音乐', '古典音乐', '电子音乐', '爵士音乐'
                ];
                
                const presetCount = Math.floor(Math.random() * 3) + 2; // 2-4个预设
                for (let j = 0; j < presetCount && j < presetNames.length; j++) {
                    // 权限规则：
                    // - 管理员创建的预设：50%公开，50%私有（用于测试）
                    // - 普通用户创建的预设：全部私有（只有管理员能创建公开预设）
                    const isPublic = user.role === 'admin' ? Math.random() > 0.5 : false;
                    
                    const preset = await createTestPreset(
                        presetNames[j],
                        device.device_id,
                        user.id,
                        user.role,
                        isPublic
                    );
                    createdPresets.push(preset);
                }

            } catch (error) {
                console.error(`创建用户 ${user.email} 的数据时出错:`, error.message);
            }
        }
    }

    // 为管理员额外创建一些公开预设，确保普通用户能看到公开预设
    console.log('\n🌍 创建额外的公开预设供所有用户使用...');
    const adminUser = testUsers.find(u => u.role === 'admin');
    if (adminUser && createdDevices.length > 0) {
        const publicPresetNames = ['通用流行', '通用摇滚', '通用古典'];
        
        // 在第一个管理员设备上创建公开预设
        const adminDevice = createdDevices.find(d => d.owner_email === adminUser.email);
        if (adminDevice) {
            for (const presetName of publicPresetNames) {
                try {
                    const publicPreset = await createTestPreset(
                        presetName,
                        adminDevice.device_id,
                        adminUser.id,
                        adminUser.role,
                        true // 必须是公开的
                    );
                    createdPresets.push(publicPreset);
                } catch (error) {
                    console.error(`创建公开预设 ${presetName} 失败:`, error.message);
                }
            }
        }
    }

    return { devices: createdDevices, presets: createdPresets };
}

/**
 * 清空测试数据
 */
async function clearTestData() {
    console.log('🧹 开始清空测试数据...');

    try {
        // 扫描所有项目
        const scanResult = await dynamoDb.send(new ScanCommand({
            TableName: TABLE_NAME
        }));

        if (!scanResult.Items || scanResult.Items.length === 0) {
            console.log('📭 表中没有数据需要清理');
            return;
        }

        console.log(`找到 ${scanResult.Items.length} 条记录，开始删除...`);

        // 删除所有项目
        for (const item of scanResult.Items) {
            await dynamoDb.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: item.PK,
                    SK: item.SK
                }
            }));
        }

        console.log(`✅ 已删除 ${scanResult.Items.length} 条记录`);
    } catch (error) {
        console.error('❌ 清空数据失败:', error.message);
        throw error;
    }
}

/**
 * 显示当前数据统计
 */
async function showDataStats() {
    try {
        const result = await dynamoDb.send(new ScanCommand({
            TableName: TABLE_NAME
        }));

        const items = result.Items || [];
        const devices = items.filter(item => item.EntityType === 'Device').length;
        const presets = items.filter(item => item.EntityType === 'Preset').length;

        console.log('\n📊 数据库统计:');
        console.log(`- 设备数量: ${devices}`);
        console.log(`- 预设数量: ${presets}`);
        console.log(`- 总记录数: ${items.length}`);

        return { devices, presets, total: items.length };
    } catch (error) {
        console.error('❌ 获取统计信息失败:', error.message);
        return { devices: 0, presets: 0, total: 0 };
    }
}

/**
 * 主函数
 */
async function main() {
    const command = process.argv[2];

    switch (command) {
        case 'create':
            try {
                const data = await createTestData();
                console.log('\n🎉 测试数据创建完成！');
                console.log(`✅ 创建了 ${data.devices.length} 个设备`);
                console.log(`✅ 创建了 ${data.presets.length} 个预设`);
                await showDataStats();
            } catch (error) {
                console.error('💥 创建数据失败:', error);
                process.exit(1);
            }
            break;

        case 'clear':
            try {
                await clearTestData();
                console.log('🎉 数据清理完成！');
                await showDataStats();
            } catch (error) {
                console.error('💥 清理数据失败:', error);
                process.exit(1);
            }
            break;

        case 'stats':
            await showDataStats();
            break;

        default:
            console.log('使用方法:');
            console.log('  node scripts/manage-data.js create  # 创建测试数据');
            console.log('  node scripts/manage-data.js clear   # 清空所有数据');
            console.log('  node scripts/manage-data.js stats   # 显示数据统计');
            break;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = {
    createTestDevice,
    createTestPreset,
    createTestData,
    clearTestData,
    showDataStats
};