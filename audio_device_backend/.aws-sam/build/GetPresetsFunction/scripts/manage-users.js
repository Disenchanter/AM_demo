/**
 * 用户管理脚本 - 创建和管理 Cognito 用户
 */

const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminUpdateUserAttributesCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });

const USER_POOL_ID = 'us-east-1_JC02HU4kc';

/**
 * 创建新用户
 */
async function createUser(email, name, role = 'user', tempPassword = 'TempPass123!') {
    try {
        console.log(`创建用户: ${email}`);
        
        // 1. 创建用户
        const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'name', Value: name },
                { Name: 'email_verified', Value: 'true' }
            ],
            TemporaryPassword: tempPassword,
            MessageAction: 'SUPPRESS' // 不发送邮件
        });

        const createResult = await cognitoClient.send(createUserCommand);
        const username = createResult.User.Username;
        console.log(`✅ 用户创建成功，用户名: ${username}`);

        // 2. 添加到对应的组
        const addToGroupCommand = new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: role
        });
        await cognitoClient.send(addToGroupCommand);
        console.log(`✅ 用户已添加到 ${role} 组`);

        // 3. 设置自定义角色属性
        const updateAttributesCommand = new AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            UserAttributes: [
                { Name: 'custom:role', Value: role }
            ]
        });
        await cognitoClient.send(updateAttributesCommand);
        console.log(`✅ 用户角色属性已设置为 ${role}`);

        return {
            username,
            email,
            name,
            role,
            tempPassword
        };

    } catch (error) {
        console.error('❌ 创建用户失败:', error.message);
        throw error;
    }
}

/**
 * 设置用户永久密码
 */
async function setUserPassword(username, password) {
    try {
        const command = new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            Password: password,
            Permanent: true
        });
        await cognitoClient.send(command);
        console.log(`✅ 用户 ${username} 密码设置成功`);
    } catch (error) {
        console.error('❌ 设置密码失败:', error.message);
        throw error;
    }
}

/**
 * 批量创建测试用户
 */
async function createTestUsers() {
    const users = [
        {
            email: 'admin@demo.com',
            name: 'Demo Admin',
            role: 'admin',
            password: 'AdminPass123!'
        },
        {
            email: 'user1@demo.com',
            name: 'Demo User 1',
            role: 'user',
            password: 'UserPass123!'
        },
        {
            email: 'user2@demo.com',
            name: 'Demo User 2',
            role: 'user',
            password: 'UserPass123!'
        }
    ];

    const createdUsers = [];

    for (const userInfo of users) {
        try {
            const user = await createUser(userInfo.email, userInfo.name, userInfo.role);
            await setUserPassword(user.username, userInfo.password);
            
            createdUsers.push({
                ...user,
                finalPassword: userInfo.password
            });
            
            console.log(`\n用户 ${userInfo.email} 创建完成:`);
            console.log(`- 邮箱: ${userInfo.email}`);
            console.log(`- 角色: ${userInfo.role}`);
            console.log(`- 密码: ${userInfo.password}`);
            console.log('-----------------------------------\n');

        } catch (error) {
            if (error.message.includes('UsernameExistsException')) {
                console.log(`⚠️  用户 ${userInfo.email} 已存在，跳过创建`);
            } else {
                console.error(`❌ 创建用户 ${userInfo.email} 失败:`, error.message);
            }
        }
    }

    return createdUsers;
}

/**
 * 主函数
 */
async function main() {
    console.log('🚀 开始创建测试用户...\n');
    
    try {
        const users = await createTestUsers();
        
        console.log('\n🎉 用户创建完成！');
        console.log('\n📋 创建的用户列表:');
        console.log('=================================');
        
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email}`);
            console.log(`   角色: ${user.role}`);
            console.log(`   密码: ${user.finalPassword}`);
            console.log('');
        });

        console.log('💡 使用提示:');
        console.log('1. 在前端应用中使用邮箱和密码登录');
        console.log('2. 管理员用户可以访问所有设备');
        console.log('3. 普通用户只能访问自己的设备');
        
    } catch (error) {
        console.error('💥 脚本执行失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = {
    createUser,
    setUserPassword,
    createTestUsers
};