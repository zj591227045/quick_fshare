const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.join(process.cwd(), '../data/quickfshare.db');
    this.isConnected = false;
  }

  /**
   * 初始化数据库连接
   */
  async connect() {
    try {
      // 确保数据目录存在
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 创建数据库连接
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('数据库连接失败:', err.message);
          throw err;
        }
        logger.info('SQLite数据库连接成功');
        this.isConnected = true;
      });

      // 启用外键约束
      await this.run('PRAGMA foreign_keys = ON');
      
      return this.db;
    } catch (error) {
      logger.error('数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行SQL查询 (返回多行结果)
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * 执行SQL查询 (返回单行结果)
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * 执行SQL语句 (INSERT, UPDATE, DELETE)
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  /**
   * 开始事务
   */
  beginTransaction() {
    return this.run('BEGIN TRANSACTION');
  }

  /**
   * 提交事务
   */
  commit() {
    return this.run('COMMIT');
  }

  /**
   * 回滚事务
   */
  rollback() {
    return this.run('ROLLBACK');
  }

  /**
   * 执行事务
   */
  async transaction(callback) {
    await this.beginTransaction();
    try {
      const result = await callback();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            logger.info('数据库连接已关闭');
            this.isConnected = false;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 备份数据库
   */
  async backup(backupPath) {
    const backupDb = new sqlite3.Database(backupPath);
    
    return new Promise((resolve, reject) => {
      this.db.backup(backupDb, (err) => {
        backupDb.close();
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 获取数据库信息
   */
  async getInfo() {
    const pragmas = await Promise.all([
      this.get('PRAGMA user_version'),
      this.get('PRAGMA application_id'),
      this.get('PRAGMA page_count'),
      this.get('PRAGMA page_size'),
      this.get('PRAGMA freelist_count'),
    ]);

    return {
      version: pragmas[0].user_version,
      applicationId: pragmas[1].application_id,
      pageCount: pragmas[2].page_count,
      pageSize: pragmas[3].page_size,
      freelistCount: pragmas[4].freelist_count,
      size: pragmas[2].page_count * pragmas[3].page_size,
      path: this.dbPath,
      connected: this.isConnected
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.get('SELECT 1 as test');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 初始化数据库表结构
   */
  async initTables() {
    try {
      // 读取并执行SQL schema文件
      const schemaPath = path.join(__dirname, '../../../database/schema.sql');
      
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // 分割SQL语句并执行
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await this.run(statement.trim());
          }
        }
        
        logger.info('数据库表结构初始化完成');
      } else {
        // 如果schema文件不存在，手动创建基础表结构
        await this.createBasicTables();
        logger.info('基础数据库表结构创建完成');
      }
    } catch (error) {
      logger.error('数据库表初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建基础表结构
   */
  async createBasicTables() {
    // 管理员表
    await this.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 分享路径表
    await this.run(`
      CREATE TABLE IF NOT EXISTS shared_paths (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        path VARCHAR(500) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('local', 'smb', 'nfs')),
        access_type VARCHAR(20) DEFAULT 'public' CHECK (access_type IN ('public', 'password')),
        password VARCHAR(255),
        enabled BOOLEAN DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 系统设置表
    await this.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        type VARCHAR(20) DEFAULT 'string',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 访问日志表
    await this.run(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shared_path_id INTEGER,
        client_ip VARCHAR(45),
        user_agent TEXT,
        file_path VARCHAR(500),
        action VARCHAR(20),
        response_code INTEGER,
        response_time INTEGER,
        file_size INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shared_path_id) REFERENCES shared_paths(id) ON DELETE SET NULL
      )
    `);
  }

  /**
   * 获取数据库统计信息
   */
  async getStats() {
    try {
      const tables = ['admins', 'shared_paths', 'system_settings', 'access_logs'];
      const stats = {};
      
      for (const table of tables) {
        try {
          const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
          stats[table] = result.count;
        } catch (error) {
          // 如果表不存在，设为0
          stats[table] = 0;
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('获取数据库统计失败:', error);
      return {};
    }
  }
}

// 创建全局数据库实例
const dbManager = new DatabaseManager();

module.exports = dbManager; 