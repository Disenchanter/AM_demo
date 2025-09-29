/**
 * User management script - create and manage Cognito users
 */

const {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    AdminUpdateUserAttributesCommand,
    AdminSetUserPasswordCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });

const USER_POOL_ID = 'us-east-1_JC02HU4kc';

/**
 * Create a new user
 */
async function createUser(email, name, role = 'user', tempPassword = 'TempPass123!') {
    try {
        console.log(`Creating user: ${email}`);

        // 1. Create the user
        const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'name', Value: name },
                { Name: 'email_verified', Value: 'true' }
            ],
            TemporaryPassword: tempPassword,
            MessageAction: 'SUPPRESS' // Do not send email notification
        });

        const createResult = await cognitoClient.send(createUserCommand);
        const username = createResult.User.Username;
        console.log(`✅ User created successfully. Username: ${username}`);

        // 2. Add the user to the appropriate group
        const addToGroupCommand = new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: role
        });
        await cognitoClient.send(addToGroupCommand);
        console.log(`✅ User added to ${role} group`);

        // 3. Set the custom role attribute
        const updateAttributesCommand = new AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            UserAttributes: [
                { Name: 'custom:role', Value: role }
            ]
        });
        await cognitoClient.send(updateAttributesCommand);
        console.log(`✅ User role attribute set to ${role}`);

        return {
            username,
            email,
            name,
            role,
            tempPassword
        };
    } catch (error) {
        console.error('❌ Failed to create user:', error.message);
        throw error;
    }
}

/**
 * Set a permanent password for the user
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
        console.log(`✅ Password set for user ${username}`);
    } catch (error) {
        console.error('❌ Failed to set password:', error.message);
        throw error;
    }
}

/**
 * Create demo users in bulk
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

            console.log(`\nUser ${userInfo.email} created:`);
            console.log(`- Email: ${userInfo.email}`);
            console.log(`- Role: ${userInfo.role}`);
            console.log(`- Password: ${userInfo.password}`);
            console.log('-----------------------------------\n');
        } catch (error) {
            if (error.message.includes('UsernameExistsException')) {
                console.log(`⚠️  User ${userInfo.email} already exists. Skipping creation.`);
            } else {
                console.error(`❌ Failed to create user ${userInfo.email}:`, error.message);
            }
        }
    }

    return createdUsers;
}

/**
 * Entry point
 */
async function main() {
    console.log('🚀 Starting demo user creation...\n');

    try {
        const users = await createTestUsers();

        console.log('\n🎉 User creation complete!');
        console.log('\n📋 Created users:');
        console.log('=================================');

        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Password: ${user.finalPassword}`);
            console.log('');
        });

        console.log('💡 Tips:');
        console.log('1. Sign in to the frontend application with the email and password.');
        console.log('2. Admin users can manage all devices.');
        console.log('3. Standard users can only access their own devices.');
    } catch (error) {
        console.error('💥 Script execution failed:', error);
        process.exit(1);
    }
}

// Allow the script to be executed directly
if (require.main === module) {
    main();
}

module.exports = {
    createUser,
    setUserPassword,
    createTestUsers
};
