const fs = require('fs').promises
const path = require('path')
const { createReadStream, createWriteStream } = require('fs')
const { pipeline } = require('stream')
const { promisify } = require('util')
const logger = require('../utils/logger')
const { validatePath } = require('../utils/validator')

const pipelineAsync = promisify(pipeline)

class FileSystemService {
  constructor() {
    this.supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
    this.supportedVideoTypes = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']
    this.supportedDocTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt']
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
   * 浏览目录内容
   */
  async browseDirectory(dirPath, options = {}) {
    const { sort = 'name', order = 'asc', search = '', limit, offset } = options

    try {
      // 验证路径安全性
      if (!validatePath(dirPath)) {
        throw new Error('无效的路径')
      }

      // 检查目录是否存在
      const stats = await fs.stat(dirPath)
      if (!stats.isDirectory()) {
        throw new Error('指定路径不是目录')
      }

      // 读取目录内容
      const items = await fs.readdir(dirPath)
      const fileInfos = []

      // 获取每个项目的详细信息
      for (const item of items) {
        try {
          const itemPath = path.join(dirPath, item)
          const info = await this.getItemInfo(itemPath)
          
          // 如果有搜索条件，进行过滤
          if (search && !info.name.toLowerCase().includes(search.toLowerCase())) {
            continue
          }

          fileInfos.push(info)
        } catch (error) {
          // 跳过无法访问的文件
          logger.warn('跳过无法访问的文件', { item, error: error.message })
          continue
        }
      }

      // 排序
      this.sortFiles(fileInfos, sort, order)

      // 分页
      const total = fileInfos.length
      let paginatedFiles = fileInfos
      if (limit) {
        const startIndex = offset || 0
        paginatedFiles = fileInfos.slice(startIndex, startIndex + limit)
      }

      // 获取父级目录路径
      const parentPath = path.dirname(dirPath)
      const isRoot = dirPath === parentPath

      return {
        current_path: dirPath,
        parent_path: isRoot ? null : parentPath,
        files: paginatedFiles,
        total,
        pagination: limit ? {
          limit,
          offset: offset || 0,
          total,
          has_more: (offset || 0) + limit < total
        } : null
      }
    } catch (error) {
      logger.error('浏览目录失败', { dirPath, error: error.message })
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
      if (!validatePath(filePath)) {
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

module.exports = new FileSystemService() 