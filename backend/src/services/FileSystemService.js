const fs = require('fs').promises
const path = require('path')
const { createReadStream, createWriteStream } = require('fs')
const { pipeline } = require('stream')
const { promisify } = require('util')
const SMB2 = require('@marsaud/smb2')
const logger = require('../utils/logger')
const Share = require('../models/Share')

const pipelineAsync = promisify(pipeline)

class FileSystemService {
  constructor() {
    this.supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
    this.supportedVideoTypes = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']
    this.supportedDocTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt']
  }

  /**
   * 验证路径安全性
   */
  validatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false
    }
    
    // 检查路径遍历攻击
    if (filePath.includes('..') || filePath.includes('~')) {
      return false
    }
    
    return true
  }

  /**
   * 获取SMB客户端连接
   */
  async getSMBClient(smbConfig) {
    try {
      logger.debug('创建SMB连接', { 
        server_ip: smbConfig.server_ip,
        share_name: smbConfig.share_name,
        username: smbConfig.username || 'guest',
        hasPassword: !!smbConfig.password,
        domain: smbConfig.domain || 'WORKGROUP'
      })

      // 每次都创建新的连接，避免连接冲突
      const smb2Client = new SMB2({
        share: `\\\\${smbConfig.server_ip}\\${smbConfig.share_name}`,
        domain: smbConfig.domain || 'WORKGROUP',
        username: smbConfig.username || 'guest',
        password: smbConfig.password || '',
        port: smbConfig.port || 445,
        timeout: smbConfig.timeout || 10000, // 减少超时时间到10秒
        autoCloseTimeout: 3000 // 3秒后自动关闭连接
      })

      logger.debug('SMB客户端创建成功')
      return smb2Client
    } catch (error) {
      logger.error('创建SMB客户端失败', { error: error.message, smbConfig })
      throw new Error(`创建SMB客户端失败: ${error.message}`)
    }
  }

  /**
   * 浏览SMB目录
   */
  async browseSMBDirectory(smbConfig, remotePath, options = {}) {
    const { sort = 'name', order = 'asc', search = '', limit = 200, offset = 0, detailed = false } = options
    const startTime = Date.now()
    let smb2Client = null

    try {
      logger.info('开始SMB目录浏览', { 
        remotePath, 
        limit, 
        offset,
        fileCount: 'unknown' 
      })
      
      smb2Client = await this.getSMBClient(smbConfig)
      // 处理路径：移除开头的斜杠，SMB路径不需要开头的斜杠
      const actualPath = remotePath === '/' ? '' : remotePath.startsWith('/') ? remotePath.substring(1) : remotePath
      
      logger.debug('SMB路径处理', { originalPath: remotePath, actualPath })

      // 读取目录内容
      const readdirStart = Date.now()
      const items = await new Promise((resolve, reject) => {
        smb2Client.readdir(actualPath, (err, files) => {
          if (err) {
            reject(new Error(`SMB错误: ${err.message}`))
          } else {
            resolve(files || [])
          }
        })
      })
      
      logger.info('SMB readdir完成', { 
        remotePath, 
        fileCount: items.length, 
        duration: Date.now() - readdirStart 
      })

      // 先进行搜索过滤（如果有搜索条件）
      let filteredItems = items
      if (search) {
        filteredItems = items.filter(item => 
          item.toLowerCase().includes(search.toLowerCase())
        )
      }

      // 暂时跳过后端排序，减少处理时间，让前端来排序
      // if (sort === 'name') {
      //   filteredItems.sort((a, b) => {
      //     const comparison = a.localeCompare(b, 'zh', { numeric: true, sensitivity: 'base' })
      //     return order === 'desc' ? -comparison : comparison
      //   })
      // }

      // 计算分页
      const total = filteredItems.length
      const paginatedItems = filteredItems.slice(offset, offset + limit)

      logger.info('SMB分页处理完成', { 
        totalItems: total,
        paginatedCount: paginatedItems.length,
        offset,
        limit
      })

      // 快速模式：跳过stat调用，使用启发式判断
      const statStart = Date.now()
      const fileInfos = []

      // 直接处理所有文件，不进行stat调用以提高性能
      for (const item of paginatedItems) {
        try {
          const itemPath = actualPath ? `${actualPath}/${item}` : item
          
          // 启发式判断文件类型
          const hasExtension = path.extname(item).length > 0
          const startsWithDot = item.startsWith('.')
          const extension = hasExtension ? path.extname(item).toLowerCase() : undefined
          
          // 基于文件名模式的简单判断
          const isDirectory = !hasExtension && !startsWithDot
          const isFile = !isDirectory

          fileInfos.push({
            name: item,
            path: `/${itemPath}`,
            type: isDirectory ? 'directory' : 'file',
            size: 0, // 跳过大小信息以提高速度
            modified: new Date().toISOString(), // 使用当前时间
            extension: extension,
            mime_type: isFile ? this.getMimeType(extension || '') : undefined,
            has_thumbnail: isFile ? this.supportsThumbnail(extension || '') : false,
            is_readable: isFile,
            permissions: {
              read: true,
              write: false,
              execute: false
            }
          })
        } catch (error) {
          logger.warn('跳过无法处理的SMB文件', { item, error: error.message })
        }
      }
      
      logger.info('SMB批量stat完成', { 
        remotePath, 
        processedCount: fileInfos.length,
        duration: Date.now() - statStart 
      })

      // 如果是按照其他属性排序，需要重新排序
      if (sort !== 'name') {
        this.sortFiles(fileInfos, sort, order)
      }

      // 获取父级目录路径
      const parentPath = remotePath === '/' ? null : path.dirname(remotePath)

      const result = {
        current_path: remotePath,
        parent_path: parentPath,
        files: fileInfos,
        total,
        pagination: {
          limit,
          offset,
          total,
          has_more: offset + limit < total,
          current_page: Math.floor(offset / limit) + 1,
          total_pages: Math.ceil(total / limit)
        }
      }

      // 主动关闭SMB连接
      this.closeSMBConnection(smb2Client)

      logger.info('SMB目录浏览完成', { 
        remotePath, 
        returnedFiles: result.files.length,
        totalFiles: result.total,
        hasMore: result.pagination.has_more,
        totalDuration: Date.now() - startTime 
      })

      return result
    } catch (error) {
      // 发生错误时也尝试关闭连接
      this.closeSMBConnection(smb2Client)
      
      logger.error('浏览SMB目录失败', { remotePath, error: error.message })
      throw new Error(`无法浏览SMB目录: ${error.message}`)
    }
  }

  /**
   * 创建SMB文件读取流
   */
  async createSMBReadStream(smbConfig, remotePath, options = {}) {
    let smb2Client = null
    
    try {
      smb2Client = await this.getSMBClient(smbConfig)
      // 处理路径：移除开头的斜杠，SMB路径不需要开头的斜杠
      const actualPath = remotePath.startsWith('/') ? remotePath.substring(1) : remotePath
      
      logger.debug('SMB读取流路径处理', { originalPath: remotePath, actualPath })

      return new Promise((resolve, reject) => {
        smb2Client.createReadStream(actualPath, (err, readStream) => {
          if (err) {
            // 立即关闭连接
            this.closeSMBConnection(smb2Client)
            reject(new Error(`无法创建SMB读取流: ${err.message}`))
          } else {
            // 添加连接引用到流对象，以便在适当时候关闭
            readStream._smbClient = smb2Client
            
            // 监听流事件
            let streamClosed = false
            
            const closeConnection = () => {
              if (!streamClosed) {
                streamClosed = true
                // 延迟关闭连接，确保流操作完成
                setTimeout(() => {
                  this.closeSMBConnection(smb2Client)
                }, 1000)
              }
            }

            readStream.on('end', closeConnection)
            readStream.on('close', closeConnection)
            readStream.on('error', (streamError) => {
              logger.error('SMB读取流错误', { error: streamError.message })
              closeConnection()
            })

            resolve(readStream)
          }
        })
      })
    } catch (error) {
      // 发生错误时也尝试关闭连接
      this.closeSMBConnection(smb2Client)
      logger.error('创建SMB读取流失败', { remotePath, error: error.message })
      throw new Error(`无法创建SMB读取流: ${error.message}`)
    }
  }

  /**
   * 安全关闭SMB连接
   */
  closeSMBConnection(smb2Client) {
    if (!smb2Client) return
    
    try {
      if (typeof smb2Client.close === 'function') {
        smb2Client.close()
      }
    } catch (closeError) {
      // 忽略关闭错误，这是正常的
      logger.debug('SMB连接关闭', { error: closeError.message })
    }
  }

  /**
   * 获取SMB文件信息
   */
  async getSMBFileInfo(smbConfig, remotePath) {
    let smb2Client = null
    
    try {
      smb2Client = await this.getSMBClient(smbConfig)
      // 处理路径：移除开头的斜杠，SMB路径不需要开头的斜杠
      const actualPath = remotePath.startsWith('/') ? remotePath.substring(1) : remotePath
      
      logger.debug('SMB文件信息路径处理', { originalPath: remotePath, actualPath })

      const stats = await new Promise((resolve, reject) => {
        smb2Client.stat(actualPath, (err, stat) => {
          if (err) {
            reject(new Error(`无法获取SMB文件信息: ${err.message}`))
          } else {
            resolve(stat)
          }
        })
      })

      // 检查文件类型
      const isDirectory = stats.isDirectory ? stats.isDirectory() : (stats.mode && (stats.mode & 0o040000) !== 0)
      const isFile = !isDirectory

      const result = {
        name: path.basename(remotePath),
        path: remotePath,
        type: isDirectory ? 'directory' : 'file',
        size: stats.size || 0,
        modified: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
        extension: isFile ? path.extname(remotePath).toLowerCase() : undefined,
        mime_type: isFile ? this.getMimeType(path.extname(remotePath).toLowerCase()) : undefined,
        has_thumbnail: isFile ? this.supportsThumbnail(path.extname(remotePath).toLowerCase()) : false,
        is_readable: isFile,
        permissions: {
          read: true,
          write: false,
          execute: false
        }
      }

      // 主动关闭SMB连接
      this.closeSMBConnection(smb2Client)

      return result
    } catch (error) {
      // 发生错误时也尝试关闭连接
      this.closeSMBConnection(smb2Client)
      logger.error('获取SMB文件信息失败', { remotePath, error: error.message })
      throw new Error(`无法获取SMB文件信息: ${error.message}`)
    }
  }

  /**
   * 获取文件/目录信息
   */
  async getItemInfo(itemPath) {
    try {
      const stats = await fs.stat(itemPath)
      const extension = path.extname(itemPath).toLowerCase()
      
      return {
        name: path.basename(itemPath),
        path: itemPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        extension: stats.isFile() ? extension : undefined,
        mime_type: this.getMimeType(extension),
        has_thumbnail: this.supportsThumbnail(extension),
        is_readable: stats.isFile(),
        permissions: {
          read: true,
          write: false, // 只读模式
          execute: stats.isFile() && this.isExecutable(extension)
        }
      }
    } catch (error) {
      logger.error('获取文件信息失败', { itemPath, error: error.message })
      throw new Error(`无法访问文件: ${error.message}`)
    }
  }

  /**
   * 浏览目录内容（根据分享类型自动选择方式）
   */
  async browseDirectory(shareOrPath, options = {}, shareId = null) {
    // 如果传入的是路径字符串，使用本地文件系统（向后兼容）
    if (typeof shareOrPath === 'string') {
      return this.browseLocalDirectory(shareOrPath, options)
    }

    // 如果传入的是分享对象或分享ID，根据类型选择浏览方式
    let share = shareOrPath
    if (typeof shareOrPath === 'number') {
      share = await Share.findById(shareOrPath)
      if (!share) {
        throw new Error('分享不存在')
      }
    }

    const { requestPath = '/' } = options

    switch (share.type) {
      case 'local':
        const fullPath = requestPath === '/' ? share.path : path.join(share.path, requestPath)
        return this.browseLocalDirectory(fullPath, options)
      
      case 'smb':
        if (!share.smbConfig) {
          throw new Error('SMB配置不存在')
        }
        return this.browseSMBDirectory(share.smbConfig, requestPath, options)
      
      case 'nfs':
        if (!share.nfsConfig) {
          throw new Error('NFS配置不存在')
        }
        // TODO: 实现NFS浏览
        throw new Error('NFS浏览暂未实现')
      
      default:
        throw new Error(`不支持的分享类型: ${share.type}`)
    }
  }

  /**
   * 浏览本地目录内容
   */
  async browseLocalDirectory(dirPath, options = {}) {
    const { sort = 'name', order = 'asc', search = '', limit = 200, offset = 0 } = options
    const startTime = Date.now()

    try {
      logger.info('开始本地目录浏览', { 
        dirPath, 
        limit, 
        offset,
        fileCount: 'unknown' 
      })

      // 验证路径安全性
      if (!this.validatePath(dirPath)) {
        throw new Error('无效的路径')
      }

      // 检查目录是否存在
      const stats = await fs.stat(dirPath)
      if (!stats.isDirectory()) {
        throw new Error('指定路径不是目录')
      }

      // 读取目录内容
      const readdirStart = Date.now()
      const items = await fs.readdir(dirPath)
      
      logger.info('本地readdir完成', { 
        dirPath, 
        fileCount: items.length, 
        duration: Date.now() - readdirStart 
      })

      // 先进行搜索过滤（如果有搜索条件）
      let filteredItems = items
      if (search) {
        filteredItems = items.filter(item => 
          item.toLowerCase().includes(search.toLowerCase())
        )
      }

      // 排序文件名（简单排序，不需要stat信息）
      if (sort === 'name') {
        filteredItems.sort((a, b) => {
          const comparison = a.localeCompare(b, 'zh', { numeric: true, sensitivity: 'base' })
          return order === 'desc' ? -comparison : comparison
        })
      }

      // 计算分页
      const total = filteredItems.length
      const paginatedItems = filteredItems.slice(offset, offset + limit)

      logger.info('本地分页处理完成', { 
        totalItems: total,
        paginatedCount: paginatedItems.length,
        offset,
        limit
      })

      // 只对当前页面的文件获取详细信息
      const statStart = Date.now()
      const fileInfos = []

      // 分批并发获取文件信息，避免过多并发请求
      const batchSize = 50 // 本地文件系统可以更高的并发
      for (let i = 0; i < paginatedItems.length; i += batchSize) {
        const batch = paginatedItems.slice(i, i + batchSize)
        
        const batchPromises = batch.map(async (item) => {
          try {
            const itemPath = path.join(dirPath, item)
            const info = await this.getItemInfo(itemPath)
            return info
          } catch (error) {
            // 跳过无法访问的文件
            logger.warn('跳过无法访问的文件', { item, error: error.message })
            return null
          }
        })
        
        // 等待当前批次完成
        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach(info => {
          if (info) {
            fileInfos.push(info)
          }
        })
      }

      logger.info('本地批量stat完成', { 
        dirPath, 
        processedCount: fileInfos.length,
        duration: Date.now() - statStart 
      })

      // 如果是按照其他属性排序，需要重新排序
      if (sort !== 'name') {
        this.sortFiles(fileInfos, sort, order)
      }

      // 获取父级目录路径
      const parentPath = path.dirname(dirPath)
      const isRoot = dirPath === parentPath

      const result = {
        current_path: dirPath,
        parent_path: isRoot ? null : parentPath,
        files: fileInfos,
        total,
        pagination: {
          limit,
          offset,
          total,
          has_more: offset + limit < total,
          current_page: Math.floor(offset / limit) + 1,
          total_pages: Math.ceil(total / limit)
        }
      }

      logger.info('本地目录浏览完成', { 
        dirPath, 
        returnedFiles: result.files.length,
        totalFiles: result.total,
        hasMore: result.pagination.has_more,
        totalDuration: Date.now() - startTime 
      })

      return result
    } catch (error) {
      logger.error('浏览本地目录失败', { dirPath, error: error.message })
      throw new Error(`无法浏览目录: ${error.message}`)
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(basePath, query, options = {}) {
    const { extensions = [], maxDepth = 3, maxResults = 100 } = options
    const results = []

    try {
      await this.searchRecursive(basePath, query, extensions, 0, maxDepth, results, maxResults)
      return results
    } catch (error) {
      logger.error('搜索文件失败', { basePath, query, error: error.message })
      throw new Error(`搜索失败: ${error.message}`)
    }
  }

  async searchRecursive(dirPath, query, extensions, currentDepth, maxDepth, results, maxResults) {
    if (currentDepth > maxDepth || results.length >= maxResults) {
      return
    }

    try {
      const items = await fs.readdir(dirPath)

      for (const item of items) {
        if (results.length >= maxResults) break

        const itemPath = path.join(dirPath, item)
        
        try {
          const stats = await fs.stat(itemPath)
          
          if (stats.isDirectory()) {
            // 递归搜索子目录
            await this.searchRecursive(itemPath, query, extensions, currentDepth + 1, maxDepth, results, maxResults)
          } else if (stats.isFile()) {
            // 检查文件名是否匹配查询
            const fileName = path.basename(itemPath)
            const extension = path.extname(itemPath).toLowerCase()
            
            const nameMatch = fileName.toLowerCase().includes(query.toLowerCase())
            const extensionMatch = extensions.length === 0 || extensions.includes(extension)
            
            if (nameMatch && extensionMatch) {
              const info = await this.getItemInfo(itemPath)
              results.push(info)
            }
          }
        } catch (error) {
          // 跳过无法访问的文件
          continue
        }
      }
    } catch (error) {
      // 跳过无法访问的目录
      return
    }
  }

  /**
   * 创建文件读取流
   */
  createReadStream(filePath, options = {}) {
    try {
      // 验证路径安全性
      if (!this.validatePath(filePath)) {
        throw new Error('无效的文件路径')
      }

      return createReadStream(filePath, options)
    } catch (error) {
      logger.error('创建文件读取流失败', { filePath, error: error.message })
      throw new Error(`无法读取文件: ${error.message}`)
    }
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(filePath) {
    try {
      const stats = await fs.stat(filePath)
      return {
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        is_directory: stats.isDirectory(),
        is_file: stats.isFile(),
        permissions: {
          readable: true,
          writable: false, // 只读模式
          executable: this.isExecutable(path.extname(filePath))
        }
      }
    } catch (error) {
      logger.error('获取文件统计信息失败', { filePath, error: error.message })
      throw new Error(`无法获取文件信息: ${error.message}`)
    }
  }

  /**
   * 检查路径是否存在且可访问
   */
  async checkAccess(itemPath) {
    try {
      await fs.access(itemPath, fs.constants.R_OK)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 排序文件列表
   */
  sortFiles(files, sortBy, order) {
    files.sort((a, b) => {
      let comparison = 0

      // 目录总是排在文件前面
      if (a.type === 'directory' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'directory') return 1

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'modified':
          comparison = new Date(a.modified) - new Date(b.modified)
          break
        case 'type':
          comparison = (a.extension || '').localeCompare(b.extension || '')
          break
        default:
          comparison = a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
      }

      return order === 'desc' ? -comparison : comparison
    })
  }

  /**
   * 获取MIME类型
   */
  getMimeType(extension) {
    const mimeTypes = {
      // 图片
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      
      // 视频
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      
      // 音频
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      
      // 文档
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.xml': 'text/xml',
      
      // 压缩文件
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
    }

    return mimeTypes[extension] || 'application/octet-stream'
  }

  /**
   * 检查是否支持缩略图
   */
  supportsThumbnail(extension) {
    return this.supportedImageTypes.includes(extension) || 
           this.supportedVideoTypes.includes(extension) ||
           extension === '.pdf'
  }

  /**
   * 检查文件是否可执行
   */
  isExecutable(extension) {
    const executableExtensions = ['.exe', '.bat', '.cmd', '.sh', '.py', '.js', '.jar']
    return executableExtensions.includes(extension)
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 获取文件扩展名统计
   */
  async getExtensionStats(dirPath) {
    const stats = {}
    
    try {
      const browse = await this.browseDirectory(dirPath)
      
      for (const file of browse.files) {
        if (file.type === 'file' && file.extension) {
          const ext = file.extension.toLowerCase()
          stats[ext] = (stats[ext] || 0) + 1
        }
      }
      
      return stats
    } catch (error) {
      logger.error('获取扩展名统计失败', { dirPath, error: error.message })
      return {}
    }
  }
}

module.exports = FileSystemService 