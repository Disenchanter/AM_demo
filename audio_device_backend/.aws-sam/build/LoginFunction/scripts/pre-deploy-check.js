/**
 * 部署前的最终检查脚本
 */

const fs = require('fs');
const path = require('path');

function checkPreDeployment() {
    console.log('🔍 开始部署前检查...\n');
    
    let allChecksPass = true;
    
    // 检查必需文件存在
    console.log('📁 检查关键文件...');
    const requiredFiles = [
        'template.yaml',
        'package.json',
        'samconfig.toml',
        '.eslintrc.json'
    ];
    
    requiredFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file} 存在`);
        } else {
            console.log(`❌ ${file} 不存在`);
            allChecksPass = false;
        }
    });
    
    // 检查 Lambda 函数数量
    console.log('\n🔧 检查 Lambda 函数...');
    const lambdaDirs = ['lambda/devices', 'lambda/presets'];
    let lambdaCount = 0;
    
    lambdaDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
            lambdaCount += files.length;
            console.log(`✅ ${dir}: ${files.length} 个函数`);
        }
    });
    
    if (lambdaCount === 0) {
        console.log('❌ 没有找到 Lambda 函数');
        allChecksPass = false;
    }
    
    // 检查共享模块
    console.log('\n📦 检查共享模块...');
    const sharedModels = ['shared/models/device.js', 'shared/models/preset.js', 'shared/models/audio-profile.js'];
    sharedModels.forEach(model => {
        if (fs.existsSync(model)) {
            console.log(`✅ ${model} 存在`);
        } else {
            console.log(`❌ ${model} 不存在`);
            allChecksPass = false;
        }
    });
    
    // 检查 package.json 依赖
    console.log('\n📋 检查依赖配置...');
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const requiredDeps = ['@aws-sdk/lib-dynamodb', '@aws-sdk/client-dynamodb', 'uuid'];
        
        requiredDeps.forEach(dep => {
            if (packageJson.dependencies && packageJson.dependencies[dep]) {
                console.log(`✅ 依赖 ${dep} 已配置`);
            } else {
                console.log(`❌ 缺少依赖 ${dep}`);
                allChecksPass = false;
            }
        });
    } catch (error) {
        console.log(`❌ 读取 package.json 失败: ${error.message}`);
        allChecksPass = false;
    }
    
    // 检查模板配置
    console.log('\n⚙️ 检查模板配置...');
    try {
        const template = fs.readFileSync('template.yaml', 'utf8');
        
        if (template.includes('nodejs20.x')) {
            console.log('✅ 使用最新的 Node.js 运行时');
        } else if (template.includes('nodejs18.x')) {
            console.log('⚠️ 使用 Node.js 18.x 运行时（建议升级到 20.x）');
        } else {
            console.log('❌ 未找到合适的 Node.js 运行时配置');
            allChecksPass = false;
        }
        
        if (template.includes('AWS::Serverless-2016-10-31')) {
            console.log('✅ SAM 模板格式正确');
        } else {
            console.log('❌ SAM 模板格式不正确');
            allChecksPass = false;
        }
    } catch (error) {
        console.log(`❌ 读取 template.yaml 失败: ${error.message}`);
        allChecksPass = false;
    }
    
    // 最终结果
    console.log('\n' + '='.repeat(50));
    if (allChecksPass) {
        console.log('🎉 所有检查通过！项目已准备好部署。');
        console.log('\n📝 部署步骤:');
        console.log('1. 安装 AWS CLI 和 SAM CLI');
        console.log('2. 配置 AWS 凭证: aws configure');
        console.log('3. 运行部署: npm run deploy:dev');
        console.log('4. 或者手动运行: sam build && sam deploy --guided');
    } else {
        console.log('💥 存在问题，请修复后重试。');
    }
    
    return allChecksPass;
}

if (require.main === module) {
    const success = checkPreDeployment();
    process.exit(success ? 0 : 1);
}

module.exports = { checkPreDeployment };