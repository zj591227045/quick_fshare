const path = require('path')
const { createReadStream } = require('fs')
const logger = require('../utils/logger')
const FileSystemService = require('../services/FileSystemService')
const ThumbnailService = require('../services/ThumbnailService')
const Share = require('../models/Share')
const { generateTemporaryToken, verifyTemporaryToken } = require('../middleware/auth')

class BrowseController {
  constructor() {
    this.fileSystemService = new FileSystemService()
    this.thumbnailService = new ThumbnailService()
  }

  /**
   * 通过ID或名称查找分享
   */
  async findShareByIdOrName(shareIdOrName, includePassword = false) {
    // 如果是纯数字，优先按ID查找
    if (/^\d+$/.test(shareIdOrName)) {
      const shareById = await Share.findById(parseInt(shareIdOrName), includePassword)
      if (shareById) {
        return shareById
      }
    }
    
    // 否则按名称查找
    const shareByName = await Share.findByName(shareIdOrName)
    if (shareByName && includePassword) {
      // 如果需要密码字段，重新查询
      return await Share.findById(shareByName.id, true)
    }
    
    return shareByName
  }
  /**
   * 浏览分享路径的文件列表
   */
  async browseFiles(req, res) {
    try {
      const { shareId } = req.params
      const { path: requestPath = '', sort = 'name', order = 'asc', search = '' } = req.query
      const clientIp = req.ip || req.connection.remoteAddress

      // 解码URL编码的路径，处理中文字符
      const decodedPath = requestPath ? decodeURIComponent(requestPath) : ''
      
      logger.debug('路径处理', { 
        originalPath: requestPath, 
        decodedPath,
        shareId 
      })

      // 获取分享配置（支持ID或名称）
      const share = await this.findShareByIdOrName(shareId)
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享路径不存在'
        })
      }

      if (!share.enabled) {
        return res.status(403).json({
          success: false,
          message: '分享路径已禁用'
        })
      }

      // 检查密码保护
      if (share.accessType === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        
        if (!token || !verifyTemporaryToken(token, share.id)) {
          return res.status(401).json({
            success: false,
            message: '需要密码验证',
            require_password: true
          })
        }
      }

      // 浏览文件（根据分享类型自动选择方式）
      const result = await this.fileSystemService.browseDirectory(share, {
        requestPath: decodedPath,
        sort,
        order,
        search,
        limit: parseInt(req.query.limit) || 200, // 默认每页200个文件
        offset: parseInt(req.query.offset) || 0
      })

      // 记录访问日志
      await this.logAccess(share.id, clientIp, decodedPath || '/', 'browse')

      res.json({
        success: true,
        data: {
          ...result,
          share_info: {
            id: share.id,
            name: share.name,
            type: share.type,
            access_type: share.accessType
          }
        }
      })
    } catch (error) {
      logger.error('浏览文件失败', {
        shareId: req.params.shareId,
        originalPath: req.query.path,
        decodedPath: req.query.path ? decodeURIComponent(req.query.path) : '',
        error: error.message
      })

      res.status(500).json({
        success: false,
        message: `浏览失败: ${error.message}`
      })
    }
  }

  /**
   * 验证分享密码
   */
  async verifyPassword(req, res) {
    try {
      const { share_id, password } = req.body

      if (!share_id || !password) {
        return res.status(400).json({
          success: false,
          message: '分享ID和密码不能为空'
        })
      }

      const share = await this.findShareByIdOrName(share_id, true) // 包含密码字段
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享路径不存在'
        })
      }

      if (share.accessType !== 'password') {
        return res.status(400).json({
          success: false,
          message: '该分享不需要密码'
        })
      }

      // 验证密码
      const isValid = await share.verifyPassword(password)
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: '密码错误'
        })
      }

      // 生成临时访问令牌 (24小时有效)
      const clientIp = req.ip || req.connection.remoteAddress;
      const token = generateTemporaryToken(share_id, clientIp);

      res.json({
        success: true,
        data: { token },
        message: '密码验证成功'
      })
    } catch (error) {
      logger.error('验证分享密码失败', {
        shareId: req.body.share_id,
        error: error.message
      })

      res.status(500).json({
        success: false,
        message: '密码验证失败'
      })
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(req, res) {
    try {
      const { shareId } = req.params
      const filePath = decodeURIComponent(req.params[0]) // 获取完整的文件路径
      const clientIp = req.ip || req.connection.remoteAddress

      // 获取分享配置（支持ID或名称）
      const share = await this.findShareByIdOrName(shareId)
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享路径不存在'
        })
      }

      if (!share.enabled) {
        return res.status(403).json({
          success: false,
          message: '分享路径已禁用'
        })
      }

      // 检查密码保护
      if (share.accessType === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, share.id)) {
          return res.status(401).json({
            success: false,
            message: '需要密码验证'
          })
        }
      }

      let fileInfo, stream

      // 检查是否是HEAD请求 - HEAD请求只需要文件信息，不需要创建流
      const isHeadRequest = req.method === 'HEAD'

      // 根据分享类型处理文件下载
      switch (share.type) {
        case 'local':
          // 本地文件下载
          const basePath = share.path
          const fullPath = path.join(basePath, filePath)

          // 验证路径安全性
          if (!fullPath.startsWith(basePath)) {
            return res.status(403).json({
              success: false,
              message: '访问路径无效'
            })
          }

          // 获取文件信息
          fileInfo = await this.fileSystemService.getItemInfo(fullPath)
          if (fileInfo.type !== 'file') {
            return res.status(400).json({
              success: false,
              message: '只能下载文件'
            })
          }

          // 只有非HEAD请求才创建流
          if (!isHeadRequest) {
            // 处理范围请求 (支持断点续传)
            const range = req.headers.range
            if (range) {
              const parts = range.replace(/bytes=/, "").split("-")
              const start = parseInt(parts[0], 10)
              const end = parts[1] ? parseInt(parts[1], 10) : fileInfo.size - 1
              const chunksize = (end - start) + 1

              res.status(206)
              res.setHeader('Content-Range', `bytes ${start}-${end}/${fileInfo.size}`)
              res.setHeader('Content-Length', chunksize)

              stream = this.fileSystemService.createReadStream(fullPath, { start, end })
            } else {
              // 普通下载
              stream = this.fileSystemService.createReadStream(fullPath)
            }
          }
          break

        case 'smb':
          // SMB文件下载
          if (!share.smbConfig) {
            return res.status(500).json({
              success: false,
              message: 'SMB配置不存在'
            })
          }

          // 获取SMB文件信息
          fileInfo = await this.fileSystemService.getSMBFileInfo(share.smbConfig, filePath)
          if (fileInfo.type !== 'file') {
            return res.status(400).json({
              success: false,
              message: '只能下载文件'
            })
          }

          // 只有非HEAD请求才创建SMB读取流
          if (!isHeadRequest) {
            stream = await this.fileSystemService.createSMBReadStream(share.smbConfig, filePath)
          }
          break

        case 'nfs':
          // NFS文件下载 - 暂未实现
          return res.status(501).json({
            success: false,
            message: 'NFS文件下载暂未实现'
          })

        default:
          return res.status(400).json({
            success: false,
            message: `不支持的分享类型: ${share.type}`
          })
      }

      // 记录下载日志
      await this.logAccess(share.id, clientIp, filePath, 'download')
      await this.recordDownload(share.id, filePath, clientIp, fileInfo.size)

      // 设置响应头
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.name)}"`)
      res.setHeader('Content-Type', fileInfo.mime_type || 'application/octet-stream')
      res.setHeader('Content-Length', fileInfo.size)
      res.setHeader('Accept-Ranges', 'bytes')

      // 检查是否是HEAD请求
      if (isHeadRequest) {
        // HEAD请求只返回响应头，不返回响应体
        return res.end()
      }

      // 管道文件流到响应
      if (stream) {
        stream.pipe(res)

        // 处理流错误
        stream.on('error', (error) => {
          logger.error('文件流错误', {
            shareId,
            filePath,
            error: error.message
          })
          
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: `下载失败: ${error.message}`
            })
          }
        })
      } else {
        // 如果没有流（不应该发生），返回错误
        return res.status(500).json({
          success: false,
          message: '无法创建文件流'
        })
      }

    } catch (error) {
      logger.error('下载文件失败', {
        shareId: req.params.shareId,
        filePath: req.params[0],
        error: error.message
      })

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: `下载失败: ${error.message}`
        })
      }
    }
  }

  /**
   * 获取文件缩略图
   */
  async getThumbnail(req, res) {
    try {
      const { shareId } = req.params
      const filePath = decodeURIComponent(req.params[0])
      const size = req.query.size || 'medium'

      // 获取分享配置（支持ID或名称）
      const share = await this.findShareByIdOrName(shareId)
      if (!share) {
        return res.status(404).send('分享路径不存在')
      }

      if (!share.enabled) {
        return res.status(403).send('分享路径已禁用')
      }

      // 检查密码保护
      if (share.accessType === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, share.id)) {
          return res.status(401).send('需要密码验证')
        }
      }

      // 构建实际文件路径
      const basePath = share.path
      const fullPath = path.join(basePath, filePath)

      // 验证路径安全性
      if (!fullPath.startsWith(basePath)) {
        return res.status(403).send('访问路径无效')
      }

      // 检查文件是否存在且支持缩略图
      const fileInfo = await this.fileSystemService.getItemInfo(fullPath)
      if (!fileInfo.has_thumbnail) {
        return res.status(400).send('文件不支持缩略图')
      }

      // 生成缩略图
      const thumbnailPath = await this.thumbnailService.generateThumbnail(fullPath, size)

      // 设置响应头
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('Cache-Control', 'public, max-age=86400') // 缓存24小时

      // 发送缩略图
      const stream = createReadStream(thumbnailPath)
      stream.pipe(res)
    } catch (error) {
      logger.error('获取缩略图失败', {
        shareId: req.params.shareId,
        filePath: req.params[0],
        error: error.message
      })

      res.status(500).send('缩略图生成失败')
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(req, res) {
    try {
      const { shareId } = req.params
      const { 
        q: query, 
        extensions, 
        type = 'all',
        sort = 'relevance',
        order = 'desc',
        limit = 100,
        offset = 0
      } = req.query
      const clientIp = req.ip || req.connection.remoteAddress

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        })
      }

      // 获取分享配置（支持ID或名称）
      const share = await this.findShareByIdOrName(shareId)
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享路径不存在'
        })
      }

      if (!share.enabled) {
        return res.status(403).json({
          success: false,
          message: '分享路径已禁用'
        })
      }

      // 检查密码保护
      if (share.accessType === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, share.id)) {
          return res.status(401).json({
            success: false,
            message: '需要密码验证'
          })
        }
      }

      // 使用新的搜索索引服务
      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()

      const extensionList = extensions ? extensions.split(',') : []
      const searchResult = await searchService.searchFiles(shareId, query.trim(), {
        extensions: extensionList,
        type: type,
        sortBy: sort,
        sortOrder: order,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      })

      // 记录搜索日志
      await this.logAccess(share.id, clientIp, `search:${query}`, 'search')

      res.json({
        success: true,
        data: {
          query: query.trim(),
          ...searchResult,
          share_info: {
            id: share.id,
            name: share.name,
            type: share.type
          }
        }
      })
    } catch (error) {
      logger.error('搜索文件失败', {
        shareId: req.params.shareId,
        query: req.query.q,
        error: error.message
      })

      res.status(500).json({
        success: false,
        message: `搜索失败: ${error.message}`
      })
    }
  }

  /**
   * 获取搜索索引状态
   */
  async getSearchIndexStatus(req, res) {
    try {
      const { shareId } = req.params

      // 获取分享配置（支持ID或名称）
      const share = await this.findShareByIdOrName(shareId)
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享路径不存在'
        })
      }

      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()
      
      const status = searchService.getIndexStatus(shareId)

      res.json({
        success: true,
        data: {
          shareId,
          shareName: share.name,
          shareType: share.type,
          indexStatus: status
        }
      })
    } catch (error) {
      logger.error('获取搜索索引状态失败', {
        shareId: req.params.shareId,
        error: error.message
      })

      res.status(500).json({
        success: false,
        message: `获取索引状态失败: ${error.message}`
      })
    }
  }

  /**
   * 重建搜索索引
   */
  async rebuildSearchIndex(req, res) {
    try {
      const { shareId } = req.params

      // 获取分享配置（支持ID或名称）
      const share = await this.findShareByIdOrName(shareId)
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享路径不存在'
        })
      }

      if (!share.enabled) {
        return res.status(403).json({
          success: false,
          message: '分享路径已禁用'
        })
      }

      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()
      
      // 异步重建索引
      searchService.rebuildIndex(shareId).catch(error => {
        logger.error('重建索引失败', { shareId, error: error.message })
      })

      res.json({
        success: true,
        message: '索引重建已开始，请稍后查看状态',
        data: {
          shareId,
          shareName: share.name
        }
      })
    } catch (error) {
      logger.error('重建搜索索引失败', {
        shareId: req.params.shareId,
        error: error.message
      })

      res.status(500).json({
        success: false,
        message: `重建索引失败: ${error.message}`
      })
    }
  }

  /**
   * 获取索引管理信息
   */
  async getIndexManagement(req, res) {
    try {
      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()
      
      // 获取所有分享的索引状态
      const Share = require('../models/Share')
      const shares = await Share.getAll()
      
      const indexInfo = await Promise.all(shares.map(async (share) => {
        const status = searchService.getIndexStatus(share.id)
        const indexPath = searchService.getIndexFilePath(share.id)
        
        // 检查磁盘文件是否存在
        const fs = require('fs').promises
        let fileExists = false
        let fileSize = 0
        try {
          const stats = await fs.stat(indexPath)
          fileExists = true
          fileSize = stats.size
        } catch (error) {
          // 文件不存在
        }

        return {
          shareId: share.id,
          shareName: share.name,
          shareType: share.type,
          indexStatus: status,
          indexPath,
          fileExists,
          fileSize,
          humanFileSize: fileSize > 0 ? this.formatFileSize(fileSize) : '-'
        }
      }))

      res.json({
        success: true,
        data: {
          indexInfo,
          totalShares: shares.length,
          indexedShares: indexInfo.filter(info => info.indexStatus.status === 'completed').length
        }
      })
    } catch (error) {
      logger.error('获取索引管理信息失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: `获取索引管理信息失败: ${error.message}`
      })
    }
  }

  /**
   * 批量重建索引
   */
  async batchRebuildIndex(req, res) {
    try {
      const { shareIds } = req.body
      
      if (!Array.isArray(shareIds) || shareIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要重建索引的分享ID列表'
        })
      }

      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()
      
      // 异步重建所有指定的索引
      const results = []
      for (const shareId of shareIds) {
        try {
          searchService.rebuildIndex(shareId).catch(error => {
            logger.error('批量重建索引失败', { shareId, error: error.message })
          })
          results.push({ shareId, status: 'started' })
        } catch (error) {
          results.push({ shareId, status: 'failed', error: error.message })
        }
      }

      res.json({
        success: true,
        message: `已开始重建 ${shareIds.length} 个分享的索引`,
        data: { results }
      })
    } catch (error) {
      logger.error('批量重建索引失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: `批量重建索引失败: ${error.message}`
      })
    }
  }

  /**
   * 清理索引
   */
  async cleanupIndexes(req, res) {
    try {
      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()
      
      await searchService.cleanupExpiredIndexes()

      res.json({
        success: true,
        message: '索引清理完成'
      })
    } catch (error) {
      logger.error('清理索引失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: `清理索引失败: ${error.message}`
      })
    }
  }

  /**
   * 触发增量更新
   */
  async triggerIncrementalUpdate(req, res) {
    try {
      const { shareId } = req.params

      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()
      
      // 触发增量更新
      await searchService.triggerIncrementalUpdate(shareId)

      res.json({
        success: true,
        message: '增量更新已完成',
        data: { shareId }
      })
    } catch (error) {
      logger.error('触发增量更新失败', { shareId: req.params.shareId, error: error.message })
      res.status(500).json({
        success: false,
        message: `增量更新失败: ${error.message}`
      })
    }
  }

  /**
   * 获取增量更新统计
   */
  async getIncrementalUpdateStats(req, res) {
    try {
      const { shareId } = req.params

      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()
      
      const stats = searchService.getIncrementalUpdateStats(shareId)
      
      if (!stats) {
        return res.status(404).json({
          success: false,
          message: '分享索引不存在'
        })
      }

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('获取增量更新统计失败', { shareId: req.params.shareId, error: error.message })
      res.status(500).json({
        success: false,
        message: `获取统计信息失败: ${error.message}`
      })
    }
  }

  /**
   * 配置增量更新
   */
  async configureIncrementalUpdate(req, res) {
    try {
      const { 
        enabled, 
        checkInterval, 
        fullRebuildThreshold 
      } = req.body

      const { getSearchIndexService } = require('../services/SearchIndexService')
      const searchService = getSearchIndexService()
      
      const newConfig = searchService.configureIncrementalUpdate({
        enabled,
        checkInterval,
        fullRebuildThreshold
      })

      res.json({
        success: true,
        message: '增量更新配置已更新',
        data: newConfig
      })
    } catch (error) {
      logger.error('配置增量更新失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: `配置失败: ${error.message}`
      })
    }
  }

  /**
   * 格式化文件大小的辅助方法
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
  }

  /**
   * 获取文件详细信息
   */
  async getFileInfo(req, res) {
    try {
      const { shareId } = req.params
      const filePath = decodeURIComponent(req.query.path || '')

      // 获取分享配置（支持ID或名称）
      const share = await this.findShareByIdOrName(shareId)
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享路径不存在'
        })
      }

      if (!share.enabled) {
        return res.status(403).json({
          success: false,
          message: '分享路径已禁用'
        })
      }

      // 检查密码保护
      if (share.accessType === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, share.id)) {
          return res.status(401).json({
            success: false,
            message: '需要密码验证'
          })
        }
      }

      // 构建实际文件路径
      const basePath = share.path
      const fullPath = filePath ? path.join(basePath, filePath) : basePath

      // 验证路径安全性
      if (!fullPath.startsWith(basePath)) {
        return res.status(403).json({
          success: false,
          message: '访问路径无效'
        })
      }

      // 获取文件信息
      const fileInfo = await this.fileSystemService.getItemInfo(fullPath)
      const fileStats = await this.fileSystemService.getFileStats(fullPath)

      res.json({
        success: true,
        data: {
          ...fileInfo,
          ...fileStats
        }
      })
    } catch (error) {
      logger.error('获取文件信息失败', {
        shareId: req.params.shareId,
        path: req.query.path,
        error: error.message
      })

      res.status(500).json({
        success: false,
        message: `获取文件信息失败: ${error.message}`
      })
    }
  }

  /**
   * 记录访问日志
   */
  async logAccess(shareId, clientIp, filePath, action) {
    try {
      const dbManager = require('../config/database')

      await dbManager.run(
        `INSERT INTO access_logs (shared_path_id, client_ip, file_path, action, accessed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [shareId, clientIp, filePath, action, new Date().toISOString()]
      )
    } catch (error) {
      logger.error('记录访问日志失败', { error: error.message })
    }
  }

  /**
   * 记录下载记录
   */
  async recordDownload(shareId, filePath, clientIp, fileSize) {
    try {
      const dbManager = require('../config/database')

      // 提取文件名
      const fileName = filePath.split('/').pop() || filePath

      await dbManager.run(
        `INSERT INTO download_records (shared_path_id, file_path, file_name, file_size, client_ip, completed, downloaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [shareId, filePath, fileName, fileSize, clientIp, 1, new Date().toISOString()]
      )

      logger.info('下载记录已保存', {
        shareId,
        filePath,
        fileName,
        fileSize,
        clientIp
      })
    } catch (error) {
      logger.error('记录下载记录失败', { error: error.message })
    }
  }
}

module.exports = BrowseController 