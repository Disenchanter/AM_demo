#!/usr/bin/env node

/**
 * SAM 部署错误忽略脚本
 * 用于在部署时忽略特定的错误或警告
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 需要忽略的错误模式
const IGNORE_PATTERNS = [
    /Warning: Failed to parse template/,
    /Warning: Unused parameter/,
    /Warning: Resource .* is not used/,
    /Warning: Deprecated property/,
    // 添加更多您想忽略的错误模式
];

/**
 * 过滤输出，移除匹配的警告
 */
function filterOutput(output) {
    const lines = output.split('\n');
    return lines.filter(line => {
        return !IGNORE_PATTERNS.some(pattern => pattern.test(line));
    }).join('\n');
}

/**
 * 执行 SAM 命令并过滤输出
 */
function runSamCommand(command) {
    console.log(`🚀 执行命令: ${command}`);
    
    try {
        const output = execSync(command, { 
            encoding: 'utf8',
            cwd: process.cwd()
        });
        
        const filteredOutput = filterOutput(output);
        if (filteredOutput.trim()) {
            console.log(filteredOutput);
        }
        
        console.log('✅ 命令执行成功');
        
    } catch (error) {
        // 过滤错误输出
        const filteredError = filterOutput(error.stdout || error.stderr || error.message);
        
        // 检查是否是我们可以忽略的错误
        const shouldIgnore = IGNORE_PATTERNS.some(pattern => 
            pattern.test(error.message) || pattern.test(error.stdout || '') || pattern.test(error.stderr || '')
        );
        
        if (shouldIgnore) {
            console.log('⚠️ 忽略警告，继续执行');
            console.log(filteredError);
        } else {
            console.error('❌ 执行失败:');
            console.error(filteredError);
            process.exit(error.status || 1);
        }
    }
}

// 获取命令行参数
const command = process.argv.slice(2).join(' ');

if (!command) {
    console.log(`
使用方法:
  node scripts/ignore-errors.js sam build
  node scripts/ignore-errors.js sam deploy --config-env dev
  node scripts/ignore-errors.js sam validate
`);
    process.exit(1);
}

runSamCommand(command);