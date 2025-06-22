#!/usr/bin/env node

const database = require('../src/config/database');
const logger = require('../src/utils/logger');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
  try {
    console.log('🚀 开始初始化数据库...');
    
    // 连接数据库
    await database.connect();
    console.log('✅ 数据库连接成功');
    
    // 初始化表结构
    await database.initTables();
    console.log('✅ 数据库表结构初始化完成');
    
    // 检查是否已有管理员账户
    const existingAdmin = await database.get('SELECT id FROM admins WHERE username = ?', ['admin']);
    
    if (!existingAdmin) {
      // 创建默认管理员账户
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      await database.run(
        'INSERT INTO admins (username, password_hash, email) VALUES (?, ?, ?)',
        ['admin', hashedPassword, 'admin@quickfshare.local']
      );
      
      console.log('✅ 默认管理员账户创建成功');
      console.log(`   用户名: admin`);
      console.log(`   密码: ${defaultPassword}`);
      console.log('   ⚠️  请在首次登录后修改默认密码！');
    } else {
      console.log('ℹ️  管理员账户已存在，跳过创建');
    }
    
    // 插入默认系统设置
    const defaultSettings = [
      ['theme', 'light', 'string', '默认主题设置'],
      ['language', 'zh-CN', 'string', '系统语言'],
      ['site_title', 'Quick FShare', 'string', '网站标题'],
      ['site_description', '局域网文件快速分享系统', 'string', '网站描述'],
      ['max_file_size', '104857600', 'number', '最大文件大小限制(字节)'],
      ['thumbnail_enabled', 'true', 'boolean', '是否启用缩略图'],
      ['thumbnail_quality', '80', 'number', '缩略图质量(1-100)'],
      ['thumbnail_max_size', '200', 'number', '缩略图最大尺寸(像素)'],
      ['log_level', 'info', 'string', '日志级别'],
      ['log_retention_days', '30', 'number', '日志保留天数'],
      ['session_timeout', '3600', 'number', '会话超时时间(秒)'],
      ['rate_limit_enabled', 'true', 'boolean', '是否启用请求频率限制'],
      ['rate_limit_window', '900000', 'number', '频率限制时间窗口(毫秒)'],
      ['rate_limit_max', '100', 'number', '频率限制最大请求数'],
      ['cors_enabled', 'true', 'boolean', '是否启用CORS'],
      ['cors_origins', '*', 'string', 'CORS允许的源'],
      ['security_headers', 'true', 'boolean', '是否启用安全头'],
      ['https_only', 'false', 'boolean', '是否仅允许HTTPS'],
      ['auto_cleanup_enabled', 'true', 'boolean', '是否自动清理过期数据'],
      ['cleanup_interval', '86400', 'number', '清理任务间隔(秒)'],
      ['monitoring_enabled', 'true', 'boolean', '是否启用监控'],
      ['stats_retention_days', '90', 'number', '统计数据保留天数'],
    ];
    
    for (const [key, value, type, description] of defaultSettings) {
      const existing = await database.get('SELECT id FROM system_settings WHERE key = ?', [key]);
      if (!existing) {
        await database.run(
          'INSERT INTO system_settings (key, value, type, description) VALUES (?, ?, ?, ?)',
          [key, value, type, description]
        );
      }
    }
    
    console.log('✅ 系统设置初始化完成');
    
    // 在开发环境中创建示例分享路径
    if (process.env.NODE_ENV === 'development') {
      const exampleShares = [
        ['本地文档', '示例文档分享', '/Users/Shared/Documents', 'local', 'public'],
        ['本地图片', '示例图片分享', '/Users/Shared/Pictures', 'local', 'public'],
      ];
      
      for (const [name, description, path, type, accessType] of exampleShares) {
        const existing = await database.get('SELECT id FROM shared_paths WHERE name = ?', [name]);
        if (!existing) {
          await database.run(
            'INSERT INTO shared_paths (name, description, path, type, access_type, enabled) VALUES (?, ?, ?, ?, ?, ?)',
            [name, description, path, type, accessType, true]
          );
        }
      }
      
      console.log('✅ 开发环境示例数据创建完成');
    }
    
    // 获取数据库统计信息
    const stats = await database.getStats();
    console.log('\n📊 数据库统计信息:');
    Object.entries(stats).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} 条记录`);
    });
    
    console.log('\n🎉 数据库初始化完成！');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    await database.close();
  }
}

// 处理命令行参数
const args = process.argv.slice(2);
const forceReset = args.includes('--reset') || args.includes('-r');

if (forceReset) {
  console.log('⚠️  检测到重置标志，将清除所有现有数据...');
}

// 运行初始化
initializeDatabase(); 