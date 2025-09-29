/**
 * Data management script - seed and clean DynamoDB demo data
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamoDb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'AudioManagement-dev';

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
            eq: [0, 2, -1, 3, 1],
            reverb: 0.3,
            last_preset_id: null,
            updated_at: now,
            sync_version: 1
        },
        is_online: true,
        last_seen: now,
        created_at: now,
        updated_at: now,
        GSI1PK: `USER#${ownerId}`,
        GSI1SK: `DEVICE#${deviceId}`
    };

    await dynamoDb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: device
    }));

    console.log(`✅ Device created: ${deviceName} (${deviceId})`);
    return device;
}

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
            volume: Math.random() * 0.5 + 0.5,
            eq: Array.from({ length: 5 }, () => Math.floor(Math.random() * 24) - 12),
            reverb: Math.random() * 0.8 + 0.1,
            last_preset_id: null,
            updated_at: now,
            sync_version: 1
        },
        created_by: creatorId,
        creator_role: creatorRole,
        is_public: isPublic,
        description: `${presetName} preset for a variety of audio scenarios`,
        usage_count: Math.floor(Math.random() * 100),
        created_at: now,
        updated_at: now,
        GSI1PK: `DEVICE#${deviceId}`,
        GSI1SK: `PRESET#${presetId}`
    };

    await dynamoDb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: preset
    }));

    console.log(`✅ Preset created: ${presetName} (${presetId})`);
    return preset;
}

async function createTestData() {
    console.log('🚀 Creating demo data...\n');

    const testUsers = [
        { id: '24680408-c031-700c-484c-5c2e517641c8', email: 'admin@demo.com', role: 'admin' },
        { id: 'e4884498-b0b1-7068-f246-db965e5ae407', email: 'user1@demo.com', role: 'user' },
        { id: '340824e8-20a1-70e0-faa1-32cf2c994142', email: 'user2@demo.com', role: 'user' }
    ];

    const createdDevices = [];
    const createdPresets = [];

    for (const user of testUsers) {
        const deviceCount = user.role === 'admin' ? 2 : 1;

        for (let i = 1; i <= deviceCount; i++) {
            const deviceName = user.role === 'admin'
                ? `Admin Device ${i}`
                : `${user.email.split('@')[0]}'s Device`;

            try {
                const device = await createTestDevice(deviceName, user.email, user.id);
                createdDevices.push(device);

                const presetNames = ['Pop Boost', 'Rock Stage', 'Classical Hall', 'Electronic Pulse', 'Smooth Jazz'];
                const presetCount = Math.min(presetNames.length, Math.floor(Math.random() * 3) + 2);

                for (let j = 0; j < presetCount; j++) {
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
                console.error(`Error creating data for user ${user.email}:`, error.message);
            }
        }
    }

    console.log('\n🌍 Creating additional public presets for all users...');
    const adminUser = testUsers.find((u) => u.role === 'admin');
    if (adminUser && createdDevices.length > 0) {
        const publicPresetNames = ['Universal Pop', 'Universal Rock', 'Universal Classical'];
        const adminDevice = createdDevices.find((device) => device.owner_email === adminUser.email);

        if (adminDevice) {
            for (const presetName of publicPresetNames) {
                try {
                    const preset = await createTestPreset(
                        presetName,
                        adminDevice.device_id,
                        adminUser.id,
                        adminUser.role,
                        true
                    );
                    createdPresets.push(preset);
                } catch (error) {
                    console.error(`Failed to create public preset ${presetName}:`, error.message);
                }
            }
        }
    }

    return { devices: createdDevices, presets: createdPresets };
}

async function clearTestData() {
    console.log('🧹 Clearing demo data...');

    const scanResult = await dynamoDb.send(new ScanCommand({
        TableName: TABLE_NAME
    }));

    if (!scanResult.Items || scanResult.Items.length === 0) {
        console.log('📭 Table is already empty');
        return;
    }

    console.log(`Found ${scanResult.Items.length} items. Deleting...`);

    for (const item of scanResult.Items) {
        await dynamoDb.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: item.PK,
                SK: item.SK
            }
        }));
    }

    console.log(`✅ Deleted ${scanResult.Items.length} items`);
}

async function showDataStats() {
    const result = await dynamoDb.send(new ScanCommand({
        TableName: TABLE_NAME
    }));

    const items = result.Items || [];
    const devices = items.filter((item) => item.EntityType === 'Device').length;
    const presets = items.filter((item) => item.EntityType === 'Preset').length;

    console.log('\n📊 Table statistics:');
    console.log(`- Devices: ${devices}`);
    console.log(`- Presets: ${presets}`);
    console.log(`- Total records: ${items.length}`);

    return { devices, presets, total: items.length };
}

async function main() {
    const command = process.argv[2];

    switch (command) {
        case 'create':
            try {
                const data = await createTestData();
                console.log('\n🎉 Demo data created successfully!');
                console.log(`✅ Devices created: ${data.devices.length}`);
                console.log(`✅ Presets created: ${data.presets.length}`);
            } catch (error) {
                console.error('💥 Failed to create data:', error);
                process.exit(1);
            }
            break;
        case 'clear':
            try {
                await clearTestData();
                console.log('🎉 Data cleanup complete!');
            } catch (error) {
                console.error('💥 Failed to clear data:', error);
                process.exit(1);
            }
            break;
        case 'stats':
            await showDataStats();
            break;
        default:
            console.log('Usage:');
            console.log('  node scripts/manage-data.js create  # Seed demo data');
            console.log('  node scripts/manage-data.js clear   # Remove all data');
            console.log('  node scripts/manage-data.js stats   # Show table statistics');
    }
}

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



