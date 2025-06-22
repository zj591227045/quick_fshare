const path = require('path')
const { createReadStream } = require('fs')
const logger = require('../utils/logger')
const FileSystemService = require('../services/FileSystemService')
const ThumbnailService = require('../services/ThumbnailService')
const Share = require('../models/Share')
const { generateTemporaryToken, verifyTemporaryToken } = require('../middleware/auth')

class BrowseController {
  /**
   * 浏览分享路径的文件列表
   */
  async browseFiles(req, res) {
    try {
      const { shareId } = req.params
      const { path: requestPath = '', sort = 'name', order = 'asc', search = '' } = req.query
      const clientIp = req.ip || req.connection.remoteAddress

      // 获取分享配置
      const share = await Share.findById(shareId)
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
      if (share.access_type === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, shareId)) {
          return res.status(401).json({
            success: false,
            message: '需要密码验证',
            require_password: true
          })
        }
      }

      // 构建实际路径
      const basePath = share.path
      const fullPath = requestPath ? path.join(basePath, requestPath) : basePath

      // 验证路径安全性
      if (!fullPath.startsWith(basePath)) {
        return res.status(403).json({
          success: false,
          message: '访问路径无效'
        })
      }

      // 浏览文件
      const result = await FileSystemService.browseDirectory(fullPath, {
        sort,
        order,
        search,
        limit: parseInt(req.query.limit) || undefined,
        offset: parseInt(req.query.offset) || undefined
      })

      // 记录访问日志
      await this.logAccess(shareId, clientIp, fullPath, 'browse')

      res.json({
        success: true,
        data: {
          ...result,
          share_info: {
            id: share.id,
            name: share.name,
            type: share.type,
            access_type: share.access_type
          }
        }
      })
    } catch (error) {
      logger.error('浏览文件失败', {
        shareId: req.params.shareId,
        path: req.query.path,
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

      const share = await Share.findById(share_id)
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享路径不存在'
        })
      }

      if (share.access_type !== 'password') {
        return res.status(400).json({
          success: false,
          message: '该分享不需要密码'
        })
      }

      // 验证密码
      const isValid = await Share.verifyPassword(share_id, password)
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: '密码错误'
        })
      }

      // 生成临时访问令牌 (24小时有效)
      const token = generateTemporaryToken(share_id, '24h')

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

      // 获取分享配置
      const share = await Share.findById(shareId)
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
      if (share.access_type === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, shareId)) {
          return res.status(401).json({
            success: false,
            message: '需要密码验证'
          })
        }
      }

      // 构建实际文件路径
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
      const fileInfo = await FileSystemService.getItemInfo(fullPath)
      if (fileInfo.type !== 'file') {
        return res.status(400).json({
          success: false,
          message: '只能下载文件'
        })
      }

      // 记录下载日志
      await this.logAccess(shareId, clientIp, fullPath, 'download')
      await this.recordDownload(shareId, fullPath, clientIp, fileInfo.size)

      // 设置响应头
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.name)}"`)
      res.setHeader('Content-Type', fileInfo.mime_type || 'application/octet-stream')
      res.setHeader('Content-Length', fileInfo.size)
      res.setHeader('Accept-Ranges', 'bytes')

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

        const stream = FileSystemService.createReadStream(fullPath, { start, end })
        stream.pipe(res)
      } else {
        // 普通下载
        const stream = FileSystemService.createReadStream(fullPath)
        stream.pipe(res)
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

      // 获取分享配置
      const share = await Share.findById(shareId)
      if (!share) {
        return res.status(404).send('分享路径不存在')
      }

      if (!share.enabled) {
        return res.status(403).send('分享路径已禁用')
      }

      // 检查密码保护
      if (share.access_type === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, shareId)) {
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
      const fileInfo = await FileSystemService.getItemInfo(fullPath)
      if (!fileInfo.has_thumbnail) {
        return res.status(400).send('文件不支持缩略图')
      }

      // 生成缩略图
      const thumbnailPath = await ThumbnailService.generateThumbnail(fullPath, size)

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
      const { q: query, extensions, max_results = 100 } = req.query
      const clientIp = req.ip || req.connection.remoteAddress

      if (!query) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        })
      }

      // 获取分享配置
      const share = await Share.findById(shareId)
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
      if (share.access_type === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, shareId)) {
          return res.status(401).json({
            success: false,
            message: '需要密码验证'
          })
        }
      }

      // 搜索文件
      const extensionList = extensions ? extensions.split(',') : []
      const results = await FileSystemService.searchFiles(share.path, query, {
        extensions: extensionList,
        maxResults: parseInt(max_results)
      })

      // 记录搜索日志
      await this.logAccess(shareId, clientIp, `search:${query}`, 'browse')

      res.json({
        success: true,
        data: {
          query,
          results,
          total: results.length
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
   * 获取文件详细信息
   */
  async getFileInfo(req, res) {
    try {
      const { shareId } = req.params
      const filePath = decodeURIComponent(req.query.path || '')

      // 获取分享配置
      const share = await Share.findById(shareId)
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
      if (share.access_type === 'password') {
        const token = req.query.token || req.headers['x-access-token']
        if (!token || !verifyTemporaryToken(token, shareId)) {
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
      const fileInfo = await FileSystemService.getItemInfo(fullPath)
      const fileStats = await FileSystemService.getFileStats(fullPath)

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
      const db = require('../config/database')
      const dbInstance = new db()
      await dbInstance.connect()

      await dbInstance.query(
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
      const db = require('../config/database')
      const dbInstance = new db()
      await dbInstance.connect()

      await dbInstance.query(
        `INSERT INTO download_records (shared_path_id, file_path, client_ip, file_size, downloaded_at)
         VALUES (?, ?, ?, ?, ?)`,
        [shareId, filePath, clientIp, fileSize, new Date().toISOString()]
      )
    } catch (error) {
      logger.error('记录下载记录失败', { error: error.message })
    }
  }
}

module.exports = new BrowseController() 