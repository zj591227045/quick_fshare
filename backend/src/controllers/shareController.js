const Share = require('../models/Share');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const dbManager = require('../config/database');
const smbEnumerate = require('smb-enumerate-shares');
const SMB2 = require('@marsaud/smb2');

/**
 * 获取分享路径列表
 */
const getShares = asyncHandler(async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      type: req.query.type,
      enabled: req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined,
      search: req.query.search,
      sortBy: req.query.sortBy || 'sort_order',
      sortOrder: req.query.sortOrder || 'ASC',
    };
    
    const result = await Share.findAll(options);
    
    res.json({
      success: true,
      data: result,
      message: '获取分享路径列表成功',
    });
    
  } catch (error) {
    logger.error('获取分享路径列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_SHARES_ERROR',
        message: '获取分享路径列表失败',
      },
    });
  }
});

/**
 * 获取单个分享路径
 */
const getShare = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const share = await Share.findById(id);
    
    if (!share) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SHARE_NOT_FOUND',
          message: '分享路径不存在',
        },
      });
    }
    
    res.json({
      success: true,
      data: { share },
      message: '获取分享路径成功',
    });
    
  } catch (error) {
    logger.error('获取分享路径失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_SHARE_ERROR',
        message: '获取分享路径失败',
      },
    });
  }
});

/**
 * 创建分享路径
 */
const createShare = asyncHandler(async (req, res) => {
  try {
    const { name, description, path, type, access_type, password, enabled, sortOrder, smb_config, nfs_config } = req.body;
    
    // 检查名称是否已存在
    const nameExists = await Share.nameExists(name);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NAME_EXISTS',
          message: '分享路径名称已存在',
        },
      });
    }
    
    // 创建分享路径
    const newShare = await Share.create({
      name,
      description,
      path,
      type,
      access_type,
      password,
      enabled,
      sortOrder,
      smbConfig: smb_config,
      nfsConfig: nfs_config,
    });
    
    logger.info('分享路径创建成功', { shareId: newShare, name, type, user: req.user.username });
    
    res.status(201).json({
      success: true,
      data: { share: newShare },
      message: '分享路径创建成功',
    });
    
  } catch (error) {
    logger.error('创建分享路径失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_SHARE_ERROR',
        message: '创建分享路径失败',
      },
    });
  }
});

/**
 * 更新分享路径
 */
const updateShare = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, path, type, access_type, password, enabled, sortOrder, smb_config, nfs_config } = req.body;
    

    
    // 检查分享路径是否存在
    const existingShare = await Share.findById(id);
    if (!existingShare) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SHARE_NOT_FOUND',
          message: '分享路径不存在',
        },
      });
    }
    
    // 检查名称是否已存在（排除当前分享路径）
    if (name && name !== existingShare.name) {
      const nameExists = await Share.nameExists(name, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NAME_EXISTS',
            message: '分享路径名称已存在',
          },
        });
      }
    }
    
    // 更新分享路径和相关配置
    const result = await dbManager.transaction(async () => {
      // 更新分享路径基本信息
      await Share.update(id, {
        name,
        description,
        path,
        type,
        access_type: access_type,
        password,
        enabled,
        sort_order: sortOrder,
      });
      
      // 处理SMB配置更新
      if (type === 'smb' && smb_config) {
        // 先删除旧配置
        await dbManager.run('DELETE FROM smb_configs WHERE shared_path_id = ?', [id]);
        // 插入新配置
        await dbManager.run(
          `INSERT INTO smb_configs (shared_path_id, server_ip, port, share_name, username, password, domain, workgroup, timeout)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            smb_config.server_ip,
            smb_config.port || 445,
            smb_config.share_name,
            smb_config.username || '',
            smb_config.password || '',
            smb_config.domain || 'WORKGROUP',
            smb_config.workgroup || 'WORKGROUP',
            smb_config.timeout || 30000
          ]
        );
      }
      
      // 处理NFS配置更新
      if (type === 'nfs' && nfs_config) {
        // 先删除旧配置
        await dbManager.run('DELETE FROM nfs_configs WHERE shared_path_id = ?', [id]);
        // 插入新配置
        await dbManager.run(
          `INSERT INTO nfs_configs (shared_path_id, server_ip, export_path, mount_point, mount_options, nfs_version, timeout)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            nfs_config.server_ip,
            nfs_config.export_path,
            nfs_config.mount_point || '',
            nfs_config.mount_options || 'ro,soft,intr',
            nfs_config.nfs_version || 'v3',
            nfs_config.timeout || 30000
          ]
        );
      }
      
      return true;
    });
    
    // 获取更新后的分享路径信息
    const updatedShare = await Share.findById(id);
    
    logger.info('分享路径更新成功', { shareId: id, user: req.user.username });
    
    res.json({
      success: true,
      data: { share: updatedShare },
      message: '分享路径更新成功',
    });
    
  } catch (error) {
    logger.error('更新分享路径失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_SHARE_ERROR',
        message: '更新分享路径失败',
      },
    });
  }
});

/**
 * 删除分享路径
 */
const deleteShare = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查分享路径是否存在
    const existingShare = await Share.findById(id);
    if (!existingShare) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SHARE_NOT_FOUND',
          message: '分享路径不存在',
        },
      });
    }
    
    // 删除分享路径（相关配置会通过外键约束自动删除）
    await Share.delete(id);
    
    logger.info('分享路径删除成功', { shareId: id, user: req.user.username });
    
    res.json({
      success: true,
      message: '分享路径删除成功',
    });
    
  } catch (error) {
    logger.error('删除分享路径失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_SHARE_ERROR',
        message: '删除分享路径失败',
      },
    });
  }
});

/**
 * 获取启用的分享路径（公开接口）
 */
const getEnabledShares = asyncHandler(async (req, res) => {
  try {
    const shares = await Share.findEnabled();
    
    // 过滤敏感信息
    const publicShares = shares.map(share => ({
      id: share.id,
      name: share.name,
      description: share.description,
      type: share.type,
      access_type: share.accessType,
      createdAt: share.createdAt,
    }));
    
    res.json({
      success: true,
      data: { shares: publicShares },
      message: '获取分享路径列表成功',
    });
    
  } catch (error) {
    logger.error('获取启用分享路径失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ENABLED_SHARES_ERROR',
        message: '获取分享路径列表失败',
      },
    });
  }
});

/**
 * 验证分享路径访问密码
 */
const validateSharePassword = asyncHandler(async (req, res) => {
  try {
    const { shareId, password } = req.body;
    
    const result = await Share.validatePassword(shareId, password);
    
    if (result.valid) {
      res.json({
        success: true,
        data: { valid: true },
        message: '密码验证成功',
      });
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: result.error || '密码错误',
        },
      });
    }
    
  } catch (error) {
    logger.error('验证分享路径密码失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATE_PASSWORD_ERROR',
        message: '验证密码失败',
      },
    });
  }
});

/**
 * 获取分享路径统计信息
 */
const getShareStats = asyncHandler(async (req, res) => {
  try {
    const stats = await Share.getStats();
    
    res.json({
      success: true,
      data: stats,
      message: '获取统计信息成功',
    });
    
  } catch (error) {
    logger.error('获取分享路径统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATS_ERROR',
        message: '获取统计信息失败',
      },
    });
  }
});

/**
 * 切换分享路径启用状态
 */
const toggleShareStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingShare = await Share.findById(id);
    if (!existingShare) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SHARE_NOT_FOUND',
          message: '分享路径不存在',
        },
      });
    }
    
    const newStatus = !existingShare.enabled;
    await Share.update(id, { enabled: newStatus });
    
    logger.info('分享路径状态切换成功', { 
      shareId: id, 
      enabled: newStatus, 
      user: req.user.username 
    });
    
    res.json({
      success: true,
      data: { enabled: newStatus },
      message: `分享路径已${newStatus ? '启用' : '禁用'}`,
    });
    
  } catch (error) {
    logger.error('切换分享路径状态失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOGGLE_STATUS_ERROR',
        message: '切换状态失败',
      },
    });
  }
});

/**
 * 枚举SMB共享
 */
const enumerateSMBShares = asyncHandler(async (req, res) => {
  try {
    const { server_ip, port = 445, username, password, domain = 'WORKGROUP' } = req.body;
    
    if (!server_ip) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SERVER_IP',
          message: '服务器地址不能为空',
        },
      });
    }

    // 构建SMB配置 - smb-enumerate-shares需要的格式
    const smbConfig = {
      host: server_ip,
      port: parseInt(port),
      username: username || '',
      password: password || '',
      domain: domain,
    };

    // 使用smb-enumerate-shares枚举共享
    const shares = await smbEnumerate(smbConfig);
    
    res.json({
      success: true,
      data: { shares },
      message: '获取SMB共享列表成功',
    });
    
  } catch (error) {
    logger.error('枚举SMB共享失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ENUMERATE_SMB_SHARES_ERROR',
        message: `枚举SMB共享失败: ${error.message}`,
      },
    });
  }
});

/**
 * 浏览SMB共享目录
 */
const browseSMBDirectory = asyncHandler(async (req, res) => {
  try {
    const { server_ip, port = 445, username, password, domain = 'WORKGROUP', share_name, path = '/' } = req.body;
    
    if (!server_ip || !share_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: '服务器地址和共享名称不能为空',
        },
      });
    }

    // 构建SMB连接配置 - SMB2需要的格式
    const smbConfig = {
      share: `\\\\${server_ip}\\${share_name}`,
      username: username || '',
      password: password || '',
      domain: domain,
    };

    // 创建SMB2客户端
    const smb2 = new SMB2(smbConfig);
    
    try {
      // 列出目录内容 - SMB2的readdir方法需要正确的路径格式
      // 注意：SMB2的readdir方法路径应该是相对于共享根目录的路径
      const fullPath = path === '/' || path === '' ? '' : path.replace(/^\//, '');
      
      // 使用SMB2的readdirAsync方法获取文件详细信息
      const files = await new Promise((resolve, reject) => {
        smb2.readdir(fullPath, (err, files) => {
          if (err) {
            reject(err);
          } else {
            // SMB2的readdir返回字符串数组，需要获取每个文件的详细信息
            const filePromises = files.map(fileName => {
              return new Promise((resolveFile, rejectFile) => {
                const filePath = fullPath ? `${fullPath}/${fileName}` : fileName;
                smb2.stat(filePath, (statErr, stats) => {
                  if (statErr) {
                    // 如果stat失败，至少返回基本信息
                    resolveFile({
                      name: fileName,
                      isDirectory: false,
                      size: 0,
                      lastWriteTime: new Date().toISOString()
                    });
                  } else {
                    resolveFile({
                      name: fileName,
                      isDirectory: stats.isDirectory(),
                      size: stats.size || 0,
                      lastWriteTime: stats.mtime ? new Date(stats.mtime * 1000).toISOString() : new Date().toISOString()
                    });
                  }
                });
              });
            });
            
            Promise.all(filePromises)
              .then(fileDetails => resolve(fileDetails))
              .catch(reject);
          }
        });
      });

      // 添加调试日志
      logger.info('SMB2返回的文件详细信息:', files);
      
      // 处理文件列表 - SMB2的文件对象需要正确判断目录
      const fileList = files.map((file, index) => {
        // 添加每个文件的详细调试信息
        logger.info(`文件 ${index}:`, {
          name: file.name,
          isDirectory: file.isDirectory,
          fileAttributes: file.fileAttributes,
          size: file.size,
          lastWriteTime: file.lastWriteTime,
          lastWriteTimeRaw: file.lastWriteTimeRaw
        });
        
        // SMB2中，目录通常没有size属性，或者size为0，但需要更准确的判断
        const isDirectory = file.isDirectory || 
                              (file.fileAttributes && file.fileAttributes.isDirectory) ||
                              (!file.size && file.name && !file.name.includes('.')) ||
                              (file.name && file.name.endsWith('/'));
        
        // 构建正确的路径
        let filePath;
        if (path === '/' || path === '') {
          filePath = `/${file.name}`;
        } else {
          // 确保路径格式正确，避免重复的斜杠
          const cleanPath = path.replace(/\/+$/, ''); // 移除末尾的斜杠
          filePath = `${cleanPath}/${file.name}`;
        }
        
        const result = {
          name: file.name,
          type: isDirectory ? 'directory' : 'file',
          size: file.size || 0,
          modified: file.lastWriteTime || file.lastWriteTimeRaw || new Date().toISOString(),
          path: filePath,
        };
        
        logger.info(`处理后的文件 ${index}:`, result);
        return result;
      });
      
      logger.info('最终文件列表:', fileList);

      res.json({
        success: true,
        data: {
          current_path: path,
          files: fileList,
          total: fileList.length,
        },
        message: '获取目录内容成功',
      });
      
    } catch (error) {
      logger.error('浏览SMB目录失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BROWSE_SMB_DIRECTORY_ERROR',
          message: `浏览SMB目录失败: ${error.message}`,
        },
      });
    }
  } catch (error) {
    logger.error('浏览SMB目录失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BROWSE_SMB_DIRECTORY_ERROR',
        message: `浏览SMB目录失败: ${error.message}`,
      },
    });
  }
});

module.exports = {
  getShares,
  getShare,
  createShare,
  updateShare,
  deleteShare,
  getEnabledShares,
  validateSharePassword,
  getShareStats,
  toggleShareStatus,
  enumerateSMBShares,
  browseSMBDirectory,
};
