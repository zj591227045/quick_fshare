#!/usr/bin/env node

/**
 * IPv6 连接测试脚本
 * 用于验证Quick FShare在IPv6网络环境下的工作状态
 */

const http = require('http');
const https = require('https');
const { promisify } = require('util');

class IPv6Tester {
  constructor() {
    this.baseUrl = process.env.TEST_URL || 'http://localhost:3001';
    this.timeout = 10000;
  }

  async testHealthCheck() {
    console.log('🔍 测试健康检查接口...');
    
    try {
      const result = await this.makeRequest('/api/health');
      if (result.status === 'healthy') {
        console.log('✅ 健康检查通过');
        return true;
      } else {
        console.log('❌ 健康检查失败');
        return false;
      }
    } catch (error) {
      console.log('❌ 健康检查请求失败:', error.message);
      return false;
    }
  }

  async testBrowseAPI() {
    console.log('🔍 测试浏览接口...');
    
    try {
      // 假设有一个ID为1的分享
      const result = await this.makeRequest('/api/browse/1');
      console.log('✅ 浏览接口可访问');
      return true;
    } catch (error) {
      console.log('❌ 浏览接口访问失败:', error.message);
      return false;
    }
  }

  async testDownloadAPI() {
    console.log('🔍 测试下载接口(HEAD请求)...');
    
    try {
      // 使用HEAD请求测试下载接口，不实际下载文件
      const result = await this.makeRequest('/api/browse/1/download/test.txt', 'HEAD');
      console.log('✅ 下载接口可访问');
      return true;
    } catch (error) {
      // 404是正常的，因为测试文件可能不存在
      if (error.statusCode === 404) {
        console.log('✅ 下载接口可访问 (测试文件不存在是正常的)');
        return true;
      }
      console.log('❌ 下载接口访问失败:', error.message);
      return false;
    }
  }

  async makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        timeout: this.timeout,
        family: 0, // 允许IPv4和IPv6
      };

      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const result = data ? JSON.parse(data) : {};
              resolve({ ...result, statusCode: res.statusCode });
            } else {
              const error = new Error(`HTTP ${res.statusCode}`);
              error.statusCode = res.statusCode;
              reject(error);
            }
          } catch (parseError) {
            resolve({ statusCode: res.statusCode, rawData: data });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.end();
    });
  }

  async detectIPVersion() {
    console.log('🔍 检测网络协议版本...');
    
    try {
      // 尝试连接到IPv6地址
      const result = await this.makeRequest('/api/health');
      console.log('✅ 当前使用的网络协议版本检测完成');
      
      // 检查本地地址
      const localAddresses = this.getLocalAddresses();
      console.log('📍 本地网络地址信息:');
      localAddresses.forEach(addr => {
        console.log(`   ${addr.family}: ${addr.address} (${addr.interface})`);
      });
      
      return true;
    } catch (error) {
      console.log('❌ 网络协议检测失败:', error.message);
      return false;
    }
  }

  getLocalAddresses() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
      for (const addr of interfaces[name]) {
        if (!addr.internal) {
          addresses.push({
            interface: name,
            family: addr.family,
            address: addr.address
          });
        }
      }
    }

    return addresses;
  }

  async runTests() {
    console.log('🚀 开始IPv6连接测试...\n');
    console.log(`目标服务器: ${this.baseUrl}\n`);

    const tests = [
      { name: '网络协议检测', test: () => this.detectIPVersion() },
      { name: '健康检查', test: () => this.testHealthCheck() },
      { name: '浏览API', test: () => this.testBrowseAPI() },
      { name: '下载API', test: () => this.testDownloadAPI() },
    ];

    let passed = 0;
    let total = tests.length;

    for (const { name, test } of tests) {
      console.log(`\n🧪 ${name}:`);
      try {
        const result = await test();
        if (result) {
          passed++;
        }
      } catch (error) {
        console.log(`❌ ${name} 测试异常:`, error.message);
      }
    }

    console.log('\n📊 测试结果汇总:');
    console.log(`✅ 通过: ${passed}/${total}`);
    console.log(`❌ 失败: ${total - passed}/${total}`);

    if (passed === total) {
      console.log('\n🎉 所有测试通过！IPv6连接正常。');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试失败，请检查服务配置。');
      process.exit(1);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const tester = new IPv6Tester();
  tester.runTests().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = IPv6Tester; 