# Quick FShare - SMB/NFS 客户端实现详解

## 概述

Quick FShare 支持连接和浏览SMB（Server Message Block）和NFS（Network File System）网络文件系统，本文档详细介绍这些功能的技术实现方案。

## SMB 客户端实现

### 1. 技术选型

**主要依赖库：**
- `node-smb2`: 纯JavaScript实现的SMB2/SMB3客户端
- `samba-client`: 系统级Samba客户端工具（作为备用方案）

**选择理由：**
- `node-smb2`：纯JavaScript实现，无需系统依赖，跨平台兼容性好
- 支持SMB2/SMB3协议，安全性更好
- 支持认证、文件浏览、下载等核心功能

### 2. SMB服务实现

**核心服务类：**
```javascript
// backend/src/services/smbService.js
const SMB2 = require('node-smb2');

class SMBService {
  constructor() {
    this.connections = new Map(); // 连接池
  }

  // 创建SMB连接
  async createConnection(config) {
    const connectionKey = `${config.serverIp}_${config.shareName}_${config.username}`;
    
    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey);
    }

    const smb2Client = new SMB2({
      share: `\\\\${config.serverIp}\\${config.shareName}`,
      domain: config.domain || 'WORKGROUP',
      username: config.username,
      password: config.password,
      autoCloseTimeout: 30000, // 30秒自动关闭
      maxProtocol: 'SMB2', // 使用SMB2协议
      packetConcurrency: 20 // 并发包数量
    });

    this.connections.set(connectionKey, smb2Client);
    return smb2Client;
  }

  // 测试连接
  async testConnection(config) {
    try {
      const client = await this.createConnection(config);
      
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        client.readdir('', (err, files) => {
          if (err) {
            reject(new Error(`SMB连接失败: ${err.message}`));
          } else {
            const responseTime = Date.now() - startTime;
            resolve({
              connected: true,
              responseTime,
              message: '连接成功',
              filesCount: files ? files.length : 0
            });
          }
        });
      });
    } catch (error) {
      throw new Error(`SMB连接测试失败: ${error.message}`);
    }
  }

  // 浏览文件
  async browseFiles(config, path = '') {
    try {
      const client = await this.createConnection(config);
      
      return new Promise((resolve, reject) => {
        client.readdir(path, (err, files) => {
          if (err) {
            reject(new Error(`无法浏览路径 ${path}: ${err.message}`));
          } else {
            const formattedFiles = files.map(file => ({
              name: file.Filename,
              type: file.FileAttributes & 0x10 ? 'directory' : 'file',
              size: file.EndOfFile,
              modified: new Date(file.LastWriteTime),
              created: new Date(file.CreationTime),
              permissions: this.parseFileAttributes(file.FileAttributes),
              mimeType: file.FileAttributes & 0x10 ? null : this.getMimeType(file.Filename)
            }));
            
            resolve(formattedFiles);
          }
        });
      });
    } catch (error) {
      throw new Error(`SMB文件浏览失败: ${error.message}`);
    }
  }

  // 下载文件
  async downloadFile(config, filePath) {
    try {
      const client = await this.createConnection(config);
      
      return new Promise((resolve, reject) => {
        client.createReadStream(filePath, (err, readStream) => {
          if (err) {
            reject(new Error(`无法下载文件 ${filePath}: ${err.message}`));
          } else {
            resolve(readStream);
          }
        });
      });
    } catch (error) {
      throw new Error(`SMB文件下载失败: ${error.message}`);
    }
  }

  // 获取文件信息
  async getFileInfo(config, filePath) {
    try {
      const client = await this.createConnection(config);
      
      return new Promise((resolve, reject) => {
        client.stat(filePath, (err, stats) => {
          if (err) {
            reject(new Error(`无法获取文件信息 ${filePath}: ${err.message}`));
          } else {
            resolve({
              name: path.basename(filePath),
              size: stats.EndOfFile,
              modified: new Date(stats.LastWriteTime),
              created: new Date(stats.CreationTime),
              isDirectory: stats.FileAttributes & 0x10 ? true : false,
              permissions: this.parseFileAttributes(stats.FileAttributes)
            });
          }
        });
      });
    } catch (error) {
      throw new Error(`获取SMB文件信息失败: ${error.message}`);
    }
  }

  // 解析文件属性
  parseFileAttributes(attributes) {
    const flags = [];
    if (attributes & 0x01) flags.push('readonly');
    if (attributes & 0x02) flags.push('hidden');
    if (attributes & 0x04) flags.push('system');
    if (attributes & 0x10) flags.push('directory');
    if (attributes & 0x20) flags.push('archive');
    return flags.join(',');
  }

  // 获取MIME类型
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // 清理连接
  closeConnection(config) {
    const connectionKey = `${config.serverIp}_${config.shareName}_${config.username}`;
    const client = this.connections.get(connectionKey);
    
    if (client) {
      client.disconnect();
      this.connections.delete(connectionKey);
    }
  }

  // 清理所有连接
  closeAllConnections() {
    for (const [key, client] of this.connections) {
      client.disconnect();
    }
    this.connections.clear();
  }
}

module.exports = new SMBService();
```

### 3. SMB配置管理

**数据库模型：**
```javascript
// backend/src/models/SMBConfig.js
const db = require('./database');

class SMBConfig {
  // 创建SMB配置
  static async create(shareId, config) {
    const sql = `
      INSERT INTO smb_configs (shared_path_id, server_ip, share_name, username, password, domain)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    return db.run(sql, [
      shareId,
      config.serverIp,
      config.shareName,
      config.username,
      config.password, // 注意：实际应用中需要加密存储
      config.domain || 'WORKGROUP'
    ]);
  }

  // 获取SMB配置
  static async getByShareId(shareId) {
    const sql = `
      SELECT * FROM smb_configs WHERE shared_path_id = ?
    `;
    
    return db.get(sql, [shareId]);
  }

  // 更新SMB配置
  static async update(shareId, config) {
    const sql = `
      UPDATE smb_configs 
      SET server_ip = ?, share_name = ?, username = ?, password = ?, domain = ?
      WHERE shared_path_id = ?
    `;
    
    return db.run(sql, [
      config.serverIp,
      config.shareName,
      config.username,
      config.password,
      config.domain,
      shareId
    ]);
  }

  // 删除SMB配置
  static async delete(shareId) {
    const sql = `DELETE FROM smb_configs WHERE shared_path_id = ?`;
    return db.run(sql, [shareId]);
  }
}

module.exports = SMBConfig;
```

## NFS 客户端实现

### 1. 技术选型

**主要依赖库：**
- `node-nfs`: Node.js NFS客户端库
- 系统级NFS工具（mount命令作为备用）

**实现策略：**
- 优先使用node-nfs库进行文件操作
- 对于复杂操作，使用系统级mount命令
- 支持NFSv3和NFSv4协议

### 2. NFS服务实现

**核心服务类：**
```javascript
// backend/src/services/nfsService.js
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class NFSService {
  constructor() {
    this.mountPoints = new Map(); // 挂载点管理
    this.tempMountDir = '/tmp/quickfshare-nfs-mounts';
  }

  // 初始化临时挂载目录
  async initTempMountDir() {
    try {
      await fs.mkdir(this.tempMountDir, { recursive: true });
    } catch (error) {
      console.error('创建临时挂载目录失败:', error);
    }
  }

  // 测试NFS连接
  async testConnection(config) {
    try {
      const startTime = Date.now();
      
      // 使用showmount命令测试NFS服务器连接
      const showmountResult = await this.executeCommand(
        `showmount -e ${config.serverIp}`
      );
      
      const responseTime = Date.now() - startTime;
      const exports = this.parseShowmountOutput(showmountResult);
      
      // 检查指定的导出路径是否存在
      const exportExists = exports.some(exp => exp.path === config.exportPath);
      
      return {
        connected: true,
        responseTime,
        message: exportExists ? '连接成功' : '导出路径不存在',
        exports: exports,
        targetExportExists: exportExists
      };
      
    } catch (error) {
      throw new Error(`NFS连接测试失败: ${error.message}`);
    }
  }

  // 挂载NFS共享
  async mountShare(config) {
    const mountPoint = path.join(
      this.tempMountDir, 
      `${config.serverIp}_${config.exportPath.replace(/\//g, '_')}`
    );
    
    try {
      // 创建挂载点目录
      await fs.mkdir(mountPoint, { recursive: true });
      
      // 构建mount命令
      const mountOptions = config.mountOptions || 'vers=3,proto=tcp,rsize=8192,wsize=8192,timeo=14,intr';
      const mountCommand = `mount -t nfs -o ${mountOptions} ${config.serverIp}:${config.exportPath} ${mountPoint}`;
      
      await this.executeCommand(mountCommand);
      
      // 存储挂载信息
      const mountKey = `${config.serverIp}_${config.exportPath}`;
      this.mountPoints.set(mountKey, {
        mountPoint,
        config,
        mountTime: new Date()
      });
      
      return mountPoint;
      
    } catch (error) {
      throw new Error(`NFS挂载失败: ${error.message}`);
    }
  }

  // 卸载NFS共享
  async unmountShare(config) {
    const mountKey = `${config.serverIp}_${config.exportPath}`;
    const mountInfo = this.mountPoints.get(mountKey);
    
    if (!mountInfo) {
      return; // 已经卸载或未挂载
    }
    
    try {
      await this.executeCommand(`umount ${mountInfo.mountPoint}`);
      
      // 删除挂载点目录
      await fs.rmdir(mountInfo.mountPoint);
      
      // 从挂载点管理中移除
      this.mountPoints.delete(mountKey);
      
    } catch (error) {
      console.error('NFS卸载失败:', error);
      // 强制卸载
      try {
        await this.executeCommand(`umount -f ${mountInfo.mountPoint}`);
        this.mountPoints.delete(mountKey);
      } catch (forceError) {
        throw new Error(`NFS强制卸载失败: ${forceError.message}`);
      }
    }
  }

  // 获取挂载点路径
  async getMountPoint(config) {
    const mountKey = `${config.serverIp}_${config.exportPath}`;
    let mountInfo = this.mountPoints.get(mountKey);
    
    if (!mountInfo) {
      // 尝试挂载
      const mountPoint = await this.mountShare(config);
      mountInfo = this.mountPoints.get(mountKey);
    }
    
    return mountInfo.mountPoint;
  }

  // 浏览文件
  async browseFiles(config, subPath = '') {
    try {
      const mountPoint = await this.getMountPoint(config);
      const fullPath = path.join(mountPoint, subPath);
      
      const files = await fs.readdir(fullPath, { withFileTypes: true });
      
      const fileList = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(fullPath, file.name);
          const stats = await fs.stat(filePath);
          
          return {
            name: file.name,
            type: file.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime,
            permissions: this.formatPermissions(stats.mode),
            mimeType: file.isDirectory() ? null : this.getMimeType(file.name)
          };
        })
      );
      
      return fileList;
      
    } catch (error) {
      throw new Error(`NFS文件浏览失败: ${error.message}`);
    }
  }

  // 下载文件
  async downloadFile(config, filePath) {
    try {
      const mountPoint = await this.getMountPoint(config);
      const fullPath = path.join(mountPoint, filePath);
      
      // 检查文件是否存在
      const stats = await fs.stat(fullPath);
      if (!stats.isFile()) {
        throw new Error('指定路径不是文件');
      }
      
      // 返回文件流
      const readStream = require('fs').createReadStream(fullPath);
      return readStream;
      
    } catch (error) {
      throw new Error(`NFS文件下载失败: ${error.message}`);
    }
  }

  // 获取文件信息
  async getFileInfo(config, filePath) {
    try {
      const mountPoint = await this.getMountPoint(config);
      const fullPath = path.join(mountPoint, filePath);
      
      const stats = await fs.stat(fullPath);
      
      return {
        name: path.basename(filePath),
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isDirectory: stats.isDirectory(),
        permissions: this.formatPermissions(stats.mode)
      };
      
    } catch (error) {
      throw new Error(`获取NFS文件信息失败: ${error.message}`);
    }
  }

  // 执行系统命令
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  // 解析showmount输出
  parseShowmountOutput(output) {
    const lines = output.split('\n').slice(1); // 跳过第一行标题
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        path: parts[0],
        clients: parts.slice(1)
      };
    }).filter(item => item.path);
  }

  // 格式化文件权限
  formatPermissions(mode) {
    const permissions = [];
    
    // 所有者权限
    permissions.push((mode & 0o400) ? 'r' : '-');
    permissions.push((mode & 0o200) ? 'w' : '-');
    permissions.push((mode & 0o100) ? 'x' : '-');
    
    // 组权限
    permissions.push((mode & 0o040) ? 'r' : '-');
    permissions.push((mode & 0o020) ? 'w' : '-');
    permissions.push((mode & 0o010) ? 'x' : '-');
    
    // 其他权限
    permissions.push((mode & 0o004) ? 'r' : '-');
    permissions.push((mode & 0o002) ? 'w' : '-');
    permissions.push((mode & 0o001) ? 'x' : '-');
    
    return permissions.join('');
  }

  // 获取MIME类型
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // 清理所有挂载点
  async cleanup() {
    const unmountPromises = Array.from(this.mountPoints.keys()).map(async (key) => {
      const mountInfo = this.mountPoints.get(key);
      try {
        await this.unmountShare(mountInfo.config);
      } catch (error) {
        console.error(`清理挂载点失败 ${key}:`, error);
      }
    });
    
    await Promise.all(unmountPromises);
  }
}

module.exports = new NFSService();
```

### 3. NFS配置管理

**数据库模型：**
```javascript
// backend/src/models/NFSConfig.js
const db = require('./database');

class NFSConfig {
  // 创建NFS配置
  static async create(shareId, config) {
    const sql = `
      INSERT INTO nfs_configs (shared_path_id, server_ip, export_path, mount_options)
      VALUES (?, ?, ?, ?)
    `;
    
    return db.run(sql, [
      shareId,
      config.serverIp,
      config.exportPath,
      config.mountOptions || 'vers=3,proto=tcp'
    ]);
  }

  // 获取NFS配置
  static async getByShareId(shareId) {
    const sql = `
      SELECT * FROM nfs_configs WHERE shared_path_id = ?
    `;
    
    return db.get(sql, [shareId]);
  }

  // 更新NFS配置
  static async update(shareId, config) {
    const sql = `
      UPDATE nfs_configs 
      SET server_ip = ?, export_path = ?, mount_options = ?
      WHERE shared_path_id = ?
    `;
    
    return db.run(sql, [
      config.serverIp,
      config.exportPath,
      config.mountOptions,
      shareId
    ]);
  }

  // 删除NFS配置
  static async delete(shareId) {
    const sql = `DELETE FROM nfs_configs WHERE shared_path_id = ?`;
    return db.run(sql, [shareId]);
  }
}

module.exports = NFSConfig;
```

## 统一文件系统服务

**文件系统抽象层：**
```javascript
// backend/src/services/fileSystemService.js
const smbService = require('./smbService');
const nfsService = require('./nfsService');
const fs = require('fs').promises;
const path = require('path');

class FileSystemService {
  // 根据分享类型获取对应的服务
  getService(shareType) {
    switch (shareType) {
      case 'smb':
        return smbService;
      case 'nfs':
        return nfsService;
      case 'local':
        return this;
      default:
        throw new Error(`不支持的分享类型: ${shareType}`);
    }
  }

  // 统一的文件浏览接口
  async browseFiles(share, subPath = '') {
    const service = this.getService(share.type);
    
    if (share.type === 'local') {
      return this.browseLocalFiles(share.path, subPath);
    } else {
      const config = await this.getNetworkConfig(share);
      return service.browseFiles(config, subPath);
    }
  }

  // 统一的文件下载接口
  async downloadFile(share, filePath) {
    const service = this.getService(share.type);
    
    if (share.type === 'local') {
      return this.downloadLocalFile(share.path, filePath);
    } else {
      const config = await this.getNetworkConfig(share);
      return service.downloadFile(config, filePath);
    }
  }

  // 本地文件浏览
  async browseLocalFiles(basePath, subPath) {
    const fullPath = path.join(basePath, subPath);
    
    // 安全检查：防止路径穿越攻击
    if (!fullPath.startsWith(basePath)) {
      throw new Error('无效的路径');
    }
    
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    
    const fileList = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(fullPath, file.name);
        const stats = await fs.stat(filePath);
        
        return {
          name: file.name,
          type: file.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          permissions: this.formatLocalPermissions(stats.mode),
          mimeType: file.isDirectory() ? null : this.getMimeType(file.name)
        };
      })
    );
    
    return fileList;
  }

  // 本地文件下载
  async downloadLocalFile(basePath, filePath) {
    const fullPath = path.join(basePath, filePath);
    
    // 安全检查
    if (!fullPath.startsWith(basePath)) {
      throw new Error('无效的路径');
    }
    
    const stats = await fs.stat(fullPath);
    if (!stats.isFile()) {
      throw new Error('指定路径不是文件');
    }
    
    return require('fs').createReadStream(fullPath);
  }

  // 获取网络配置
  async getNetworkConfig(share) {
    if (share.type === 'smb') {
      const SMBConfig = require('../models/SMBConfig');
      return await SMBConfig.getByShareId(share.id);
    } else if (share.type === 'nfs') {
      const NFSConfig = require('../models/NFSConfig');
      return await NFSConfig.getByShareId(share.id);
    }
    
    throw new Error(`不支持的网络分享类型: ${share.type}`);
  }

  // 格式化本地文件权限
  formatLocalPermissions(mode) {
    return '0' + (mode & parseInt('777', 8)).toString(8);
  }

  // 获取MIME类型
  getMimeType(filename) {
    const mime = require('mime-types');
    return mime.lookup(filename) || 'application/octet-stream';
  }

  // 测试连接
  async testConnection(shareType, config) {
    const service = this.getService(shareType);
    
    if (shareType === 'local') {
      try {
        await fs.access(config.path);
        return {
          connected: true,
          responseTime: 0,
          message: '本地路径可访问'
        };
      } catch (error) {
        throw new Error(`本地路径不可访问: ${error.message}`);
      }
    } else {
      return service.testConnection(config);
    }
  }
}

module.exports = new FileSystemService();
```

## Docker 环境支持

**Dockerfile 系统依赖：**
```dockerfile
# 安装SMB和NFS客户端工具
RUN apk add --no-cache \
    samba-client \
    nfs-utils \
    cifs-utils \
    && rm -rf /var/cache/apk/*
```

**Docker Compose 配置：**
```yaml
services:
  quickfshare:
    # ... 其他配置
    cap_add:
      - SYS_ADMIN  # 需要挂载权限
    devices:
      - /dev/fuse  # FUSE设备支持
    security_opt:
      - apparmor:unconfined  # 允许挂载操作
```

## 安全考虑

### 1. 认证信息安全
- SMB/NFS密码使用AES加密存储
- 连接超时自动清理
- 连接池限制防止资源耗尽

### 2. 路径安全
- 严格的路径验证防止目录穿越
- 文件类型白名单
- 文件大小限制

### 3. 网络安全
- 连接超时设置
- 重试机制和频率限制
- 异常处理和日志记录

## 故障处理

### 1. SMB连接问题
- 协议版本不兼容：自动降级到SMB1
- 认证失败：详细错误信息返回
- 网络超时：自动重试机制

### 2. NFS挂载问题
- 权限不足：提示需要root权限
- 挂载点冲突：自动清理旧挂载点
- 网络中断：自动重新挂载

### 3. 监控和日志
- 连接状态实时监控
- 详细的操作日志
- 性能指标统计

通过以上实现方案，Quick FShare 能够可靠地支持SMB和NFS网络文件系统的浏览和下载功能，为用户提供统一的文件分享体验。 