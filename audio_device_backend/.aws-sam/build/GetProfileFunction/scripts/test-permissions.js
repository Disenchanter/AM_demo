/**
 * 权限验证测试脚本
 * 测试新的预设权限规则是否正确工作
 */

const https = require('https');
const querystring = require('querystring');

// 配置信息（从部署输出获得）
const API_BASE_URL = 'https://f0xsnhnui6.execute-api.us-east-1.amazonaws.com/dev';
const COGNITO_REGION = 'us-east-1';
const USER_POOL_ID = 'us-east-1_JC02HU4kc';
const CLIENT_ID = '7bftlfh7a3uflvi8k1rjbb4ooe';

// 测试用户
const TEST_USERS = [
    { email: 'admin@demo.com', password: 'AdminPass123!', role: 'admin' },
    { email: 'user1@demo.com', password: 'UserPass123!', role: 'user' },
    { email: 'user2@demo.com', password: 'UserPass123!', role: 'user' }
];

/**
 * 获取用户的JWT Token
 */
async function getUserToken(email, password) {
    const AWS = require('@aws-sdk/client-cognito-identity-provider');
    const client = new AWS.CognitoIdentityProviderClient({ region: COGNITO_REGION });
    
    try {
        const command = new AWS.InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: CLIENT_ID,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        });
        
        const response = await client.send(command);
        return response.AuthenticationResult.IdToken; // 使用 IdToken 而不是 AccessToken
    } catch (error) {
        console.error(`❌ 获取 ${email} 的token失败:`, error.message);
        return null;
    }
}

/**
 * 发送API请求
 */
async function apiRequest(url, token, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        if (body && method !== 'GET') {
            body = JSON.stringify(body);
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        if (body && method !== 'GET') {
            req.write(body);
        }
        req.end();
    });
}

/**
 * 测试用户权限
 */
async function testUserPermissions(user, token) {
    console.log(`\n🧪 测试用户 ${user.email} (${user.role}) 的权限:`);
    console.log('=' + '='.repeat(50));

    try {
        // 1. 获取设备列表
        const devicesResponse = await apiRequest(`${API_BASE_URL}/api/devices`, token);
        console.log(`📱 设备列表 (状态: ${devicesResponse.status}):`);
        if (devicesResponse.data.success) {
            const devices = devicesResponse.data.data.devices || [];
            console.log(`   找到 ${devices.length} 个设备`);
            devices.forEach(device => {
                console.log(`   - ${device.deviceName || device.name || 'unnamed'} (ID: ${device.deviceId || device.id ? (device.deviceId || device.id).substring(0, 8) + '...' : 'unknown'})`);
            });

            // 2. 测试第一个设备的预设
            if (devices.length > 0) {
                const deviceId = devices[0].deviceId || devices[0].id;
                const presetsResponse = await apiRequest(`${API_BASE_URL}/api/devices/${deviceId}/presets`, token);
                console.log(`\n🎵 设备预设 (状态: ${presetsResponse.status}):`);
                
                if (presetsResponse.data.success) {
                    const presets = presetsResponse.data.data.presets || [];
                    console.log(`   找到 ${presets.length} 个预设`);
                    
                    let publicCount = 0, privateCount = 0, userOwnCount = 0;
                    presets.forEach(preset => {
                        if (preset.isPublic) publicCount++;
                        else privateCount++;
                        if (preset.createdBy === user.id) userOwnCount++;
                        
                        console.log(`   - ${preset.name} (${preset.isPublic ? '公开' : '私有'}) by ${preset.creatorRole}`);
                    });
                    
                    console.log(`   📊 统计: ${publicCount} 个公开, ${privateCount} 个私有, ${userOwnCount} 个自己的`);
                } else {
                    console.log(`   ❌ 获取预设失败: ${presetsResponse.data.error}`);
                }

                // 3. 测试创建公开预设 (只有管理员应该成功)
                console.log(`\n🆕 测试创建公开预设:`);
                const createPublicResponse = await apiRequest(
                    `${API_BASE_URL}/api/devices/${deviceId}/presets`,
                    token,
                    'POST',
                    {
                        name: `${user.role}_公开预设_${Date.now()}`,
                        volume: 0.8,
                        eq: [1, 2, -1, 0, 1],
                        reverb: 0.3,
                        is_public: true
                    }
                );
                
                if (createPublicResponse.status === 201) {
                    console.log(`   ✅ 成功创建公开预设`);
                } else if (createPublicResponse.status === 403) {
                    console.log(`   ✅ 正确阻止创建公开预设 (权限不足)`);
                } else {
                    console.log(`   ❓ 意外结果 (状态 ${createPublicResponse.status}): ${createPublicResponse.data.error || createPublicResponse.data.message}`);
                }

                // 4. 测试创建私有预设 (所有用户都应该成功)
                console.log(`\n🔒 测试创建私有预设:`);
                const createPrivateResponse = await apiRequest(
                    `${API_BASE_URL}/api/devices/${deviceId}/presets`,
                    token,
                    'POST',
                    {
                        name: `${user.role}_私有预设_${Date.now()}`,
                        volume: 0.6,
                        eq: [0, 1, -2, 1, 0],
                        reverb: 0.2,
                        is_public: false
                    }
                );
                
                if (createPrivateResponse.status === 201) {
                    console.log(`   ✅ 成功创建私有预设`);
                } else {
                    console.log(`   ❌ 创建私有预设失败 (状态 ${createPrivateResponse.status}): ${createPrivateResponse.data.error}`);
                }
            }
        } else {
            console.log(`   ❌ 获取设备失败: ${devicesResponse.data.error}`);
        }

    } catch (error) {
        console.error(`❌ 测试用户 ${user.email} 时出错:`, error.message);
    }
}

/**
 * 主测试函数
 */
async function runPermissionTests() {
    console.log('🚀 开始权限验证测试...\n');
    console.log('📋 预期行为:');
    console.log('- 管理员: 可以看到所有预设，可以创建公开预设');
    console.log('- 普通用户: 只能看到自己的预设+公开预设，只能创建私有预设');
    
    // 安装依赖
    try {
        const { execSync } = require('child_process');
        console.log('\n📦 检查依赖...');
        execSync('npm list @aws-sdk/client-cognito-identity-provider', { stdio: 'ignore' });
    } catch (error) {
        console.log('📦 安装必要依赖...');
        const { execSync } = require('child_process');
        execSync('npm install @aws-sdk/client-cognito-identity-provider', { stdio: 'inherit' });
    }

    for (const user of TEST_USERS) {
        console.log(`\n🔐 获取 ${user.email} 的认证token...`);
        const token = await getUserToken(user.email, user.password);
        
        if (token) {
            console.log(`✅ Token获取成功`);
            await testUserPermissions(user, token);
        } else {
            console.log(`❌ 无法获取token，跳过此用户测试`);
        }
        
        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🏁 权限验证测试完成！');
    console.log('\n📝 总结:');
    console.log('✅ 如果看到管理员能创建公开预设，普通用户被正确阻止，则权限逻辑工作正常');
    console.log('✅ 所有用户都应该能创建私有预设');
    console.log('✅ 普通用户应该只能看到自己的预设和公开预设');
}

// 运行测试
if (require.main === module) {
    runPermissionTests().catch(console.error);
}

module.exports = { runPermissionTests };