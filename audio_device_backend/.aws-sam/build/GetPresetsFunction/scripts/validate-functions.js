/**
 * 验证 Lambda 函数的基本语法和依赖
 */

const fs = require('fs');
const path = require('path');

const lambdaDir = path.join(__dirname, '../lambda');

function validateFile(filePath) {
    console.log(`验证文件: ${filePath}`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 检查是否使用了正确的 AWS SDK v3 语法
        if (content.includes("require('aws-sdk')")) {
            throw new Error(`文件仍使用旧版 AWS SDK: ${filePath}`);
        }
        
        // 检查是否使用了 .promise() 调用
        if (content.includes('.promise()')) {
            throw new Error(`文件仍使用旧版 promise 语法: ${filePath}`);
        }
        
        // 基本语法检查
        try {
            require(filePath);
        } catch (err) {
            if (!err.message.includes('Cannot find module')) {
                throw new Error(`文件语法错误: ${filePath} - ${err.message}`);
            }
        }
        
        console.log(`✅ ${path.basename(filePath)} 验证通过`);
        return true;
    } catch (error) {
        console.error(`❌ ${path.basename(filePath)} 验证失败: ${error.message}`);
        return false;
    }
}

function walkDir(dir) {
    const files = [];
    const list = fs.readdirSync(dir);
    
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            files.push(...walkDir(filePath));
        } else if (path.extname(file) === '.js') {
            files.push(filePath);
        }
    });
    
    return files;
}

function main() {
    console.log('开始验证 Lambda 函数...\n');
    
    if (!fs.existsSync(lambdaDir)) {
        console.error('Lambda 目录不存在');
        process.exit(1);
    }
    
    const lambdaFiles = walkDir(lambdaDir);
    let allValid = true;
    
    lambdaFiles.forEach(file => {
        if (!validateFile(file)) {
            allValid = false;
        }
    });
    
    console.log('\n验证共享模块...');
    const sharedDir = path.join(__dirname, '../shared');
    if (fs.existsSync(sharedDir)) {
        const sharedFiles = walkDir(sharedDir);
        sharedFiles.forEach(file => {
            if (!validateFile(file)) {
                allValid = false;
            }
        });
    }
    
    if (allValid) {
        console.log('\n🎉 所有文件验证通过！');
        process.exit(0);
    } else {
        console.log('\n💥 存在验证错误，请修复后重试');
        process.exit(1);
    }
}

main();