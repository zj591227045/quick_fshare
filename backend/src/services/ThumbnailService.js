const sharp = require('sharp')
const fs = require('fs').promises
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const logger = require('../utils/logger')
const dbManager = require('../config/database')

const execAsync = promisify(exec)

class ThumbnailService {
  constructor() {
    this.thumbnailCache = new Map()
    this.cacheDir = path.join(process.cwd(), 'data', 'thumbnails')
    this.maxCacheSize = 1000 // 最大缓存数量
    this.thumbnailSizes = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 }
    }
    this.db = dbManager
    
    this.init()
  }

  async init() {
    try {
      // 确保缩略图目录存在
      await fs.mkdir(this.cacheDir, { recursive: true })
      
      // 数据库连接已在主程序中建立，这里无需重复连接
      
      // 加载缓存数据
      await this.loadCache()
      
      logger.info('缩略图服务初始化成功', { cacheDir: this.cacheDir })
    } catch (error) {
      logger.error('缩略图服务初始化失败', { error: error.message })
    }
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(filePath, size = 'medium', forceRegenerate = false) {
    try {
      const extension = path.extname(filePath).toLowerCase()
      const thumbnailPath = this.getThumbnailPath(filePath, size)
      
      // 检查缓存
      if (!forceRegenerate && await this.isThumbnailCached(filePath, size)) {
        const cachedPath = await this.getCachedThumbnailPath(filePath, size)
        if (cachedPath && await this.fileExists(cachedPath)) {
          return cachedPath
        }
      }

      // 根据文件类型生成缩略图
      let generatedPath
      if (this.isImageFile(extension)) {
        generatedPath = await this.generateImageThumbnail(filePath, thumbnailPath, size)
      } else if (this.isVideoFile(extension)) {
        generatedPath = await this.generateVideoThumbnail(filePath, thumbnailPath, size)
      } else if (extension === '.pdf') {
        generatedPath = await this.generatePdfThumbnail(filePath, thumbnailPath, size)
      } else {
        throw new Error(`不支持的文件类型: ${extension}`)
      }

      // 更新缓存
      await this.updateCache(filePath, size, generatedPath)
      
      return generatedPath
    } catch (error) {
      logger.error('生成缩略图失败', { filePath, size, error: error.message })
      throw new Error(`缩略图生成失败: ${error.message}`)
    }
  }

  /**
   * 生成图片缩略图
   */
  async generateImageThumbnail(imagePath, outputPath, size) {
    try {
      const { width, height } = this.thumbnailSizes[size]
      
      await sharp(imagePath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 80,
          progressive: true
        })
        .toFile(outputPath)

      logger.debug('图片缩略图生成成功', { imagePath, outputPath, size })
      return outputPath
    } catch (error) {
      logger.error('图片缩略图生成失败', { imagePath, error: error.message })
      throw error
    }
  }

  /**
   * 生成视频缩略图
   */
  async generateVideoThumbnail(videoPath, outputPath, size) {
    try {
      const { width, height } = this.thumbnailSizes[size]
      
      // 检查是否有 ffmpeg
      try {
        await execAsync('ffmpeg -version')
      } catch (error) {
        throw new Error('系统未安装 ffmpeg，无法生成视频缩略图')
      }

      // 使用 ffmpeg 提取视频第一帧
      const tempImagePath = outputPath.replace('.jpg', '_temp.jpg')
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -f image2 "${tempImagePath}"`
      
      await execAsync(ffmpegCommand)

      // 使用 sharp 调整大小
      await sharp(tempImagePath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 80,
          progressive: true
        })
        .toFile(outputPath)

      // 删除临时文件
      await fs.unlink(tempImagePath).catch(() => {})

      logger.debug('视频缩略图生成成功', { videoPath, outputPath, size })
      return outputPath
    } catch (error) {
      logger.error('视频缩略图生成失败', { videoPath, error: error.message })
      throw error
    }
  }

  /**
   * 生成PDF缩略图
   */
  async generatePdfThumbnail(pdfPath, outputPath, size) {
    try {
      const { width, height } = this.thumbnailSizes[size]
      
      // 检查是否有 pdftoppm (poppler-utils)
      try {
        await execAsync('pdftoppm -v')
      } catch (error) {
        throw new Error('系统未安装 poppler-utils，无法生成PDF缩略图')
      }

      // 使用 pdftoppm 提取PDF第一页
      const tempImagePath = outputPath.replace('.jpg', '_temp.ppm')
      const pdftoppmCommand = `pdftoppm -jpeg -f 1 -l 1 -scale-to ${Math.max(width, height)} "${pdfPath}" "${tempImagePath}"`
      
      await execAsync(pdftoppmCommand)

      // 查找生成的文件
      const generatedFiles = await fs.readdir(path.dirname(tempImagePath))
      const ppmFile = generatedFiles.find(file => file.startsWith(path.basename(tempImagePath)) && file.endsWith('.jpg'))
      
      if (!ppmFile) {
        throw new Error('PDF缩略图生成失败，未找到生成的文件')
      }

      const actualTempPath = path.join(path.dirname(tempImagePath), ppmFile)

      // 使用 sharp 调整大小
      await sharp(actualTempPath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 80,
          progressive: true
        })
        .toFile(outputPath)

      // 删除临时文件
      await fs.unlink(actualTempPath).catch(() => {})

      logger.debug('PDF缩略图生成成功', { pdfPath, outputPath, size })
      return outputPath
    } catch (error) {
      logger.error('PDF缩略图生成失败', { pdfPath, error: error.message })
      throw error
    }
  }

  /**
   * 获取缩略图路径
   */
  getThumbnailPath(filePath, size) {
    const hash = this.generatePathHash(filePath)
    const filename = `${hash}_${size}.jpg`
    return path.join(this.cacheDir, filename)
  }

  /**
   * 生成文件路径哈希
   */
  generatePathHash(filePath) {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(filePath).digest('hex')
  }

  /**
   * 检查缩略图是否已缓存
   */
  async isThumbnailCached(filePath, size) {
    try {
      const cacheKey = `${filePath}_${size}`
      
      // 检查内存缓存
      if (this.thumbnailCache.has(cacheKey)) {
        return true
      }

      // 检查数据库缓存 - 通过cache_path包含尺寸信息来判断
      const expectedPath = this.getThumbnailPath(filePath, size)
      const result = await this.db.all(
        'SELECT * FROM thumbnail_cache WHERE file_path = ? AND cache_path = ?',
        [filePath, expectedPath]
      )

      return result.length > 0
    } catch (error) {
      logger.error('检查缩略图缓存失败', { filePath, size, error: error.message })
      return false
    }
  }

  /**
   * 获取缓存的缩略图路径
   */
  async getCachedThumbnailPath(filePath, size) {
    try {
      const cacheKey = `${filePath}_${size}`
      
      // 检查内存缓存
      if (this.thumbnailCache.has(cacheKey)) {
        return this.thumbnailCache.get(cacheKey).cache_path
      }

      // 检查数据库缓存
      const expectedPath = this.getThumbnailPath(filePath, size)
      const result = await this.db.all(
        'SELECT cache_path FROM thumbnail_cache WHERE file_path = ? AND cache_path = ?',
        [filePath, expectedPath]
      )

      if (result.length > 0) {
        const thumbnailPath = result[0].cache_path
        this.thumbnailCache.set(cacheKey, { cache_path: thumbnailPath })
        return thumbnailPath
      }

      return null
    } catch (error) {
      logger.error('获取缓存缩略图路径失败', { filePath, size, error: error.message })
      return null
    }
  }

  /**
   * 更新缓存
   */
  async updateCache(filePath, size, thumbnailPath) {
    try {
      const cacheKey = `${filePath}_${size}`
      const now = new Date().toISOString()
      
      // 获取文件hash和大小
      const fileHash = this.generatePathHash(filePath)
      let fileSize = 0
      try {
        const stats = await fs.stat(filePath)
        fileSize = stats.size
      } catch (error) {
        logger.warn('获取文件大小失败', { filePath, error: error.message })
      }

      // 更新数据库缓存
      await this.db.run(
        `INSERT OR REPLACE INTO thumbnail_cache 
         (file_path, cache_path, file_hash, file_size, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [filePath, thumbnailPath, fileHash, fileSize, now]
      )

      // 更新内存缓存
      this.thumbnailCache.set(cacheKey, {
        cache_path: thumbnailPath,
        created_at: now
      })

      // 清理过期缓存
      await this.cleanupCache()

      logger.debug('缓存更新成功', { filePath, size, thumbnailPath })
    } catch (error) {
      logger.error('更新缓存失败', { filePath, size, error: error.message })
    }
  }

  /**
   * 加载缓存
   */
  async loadCache() {
    try {
      const result = await this.db.all(
        'SELECT * FROM thumbnail_cache ORDER BY created_at DESC LIMIT ?',
        [this.maxCacheSize]
      )

      this.thumbnailCache.clear()
      for (const row of result) {
        // 从cache_path推断size
        const sizePart = path.basename(row.cache_path).split('_')[1]
        const size = sizePart ? sizePart.split('.')[0] : 'medium'
        const cacheKey = `${row.file_path}_${size}`
        this.thumbnailCache.set(cacheKey, row)
      }

      logger.info('缓存加载完成', { count: result.length })
    } catch (error) {
      logger.error('加载缓存失败', { error: error.message })
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanupCache() {
    try {
      // 清理超过限制数量的缓存
      const countResult = await this.db.get('SELECT COUNT(*) as count FROM thumbnail_cache')
      const totalCount = countResult.count

      if (totalCount > this.maxCacheSize) {
        const toDelete = totalCount - this.maxCacheSize
        
        const oldRecords = await this.db.all(
          'SELECT * FROM thumbnail_cache ORDER BY created_at ASC LIMIT ?',
          [toDelete]
        )

        for (const record of oldRecords) {
          // 删除缩略图文件
          try {
            await fs.unlink(record.cache_path)
          } catch (error) {
            // 忽略文件删除错误
          }

          // 从数据库删除
          await this.db.run(
            'DELETE FROM thumbnail_cache WHERE id = ?',
            [record.id]
          )

          // 从内存缓存删除 - 推断size
          const sizePart = path.basename(record.cache_path).split('_')[1]
          const size = sizePart ? sizePart.split('.')[0] : 'medium'
          const cacheKey = `${record.file_path}_${size}`
          this.thumbnailCache.delete(cacheKey)
        }

        logger.info('缓存清理完成', { deleted: toDelete })
      }

      // 清理超过30天的缓存
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const expiredRecords = await this.db.all(
        'SELECT * FROM thumbnail_cache WHERE created_at < ?',
        [thirtyDaysAgo]
      )

      for (const record of expiredRecords) {
        try {
          await fs.unlink(record.cache_path)
        } catch (error) {
          // 忽略文件删除错误
        }

        await this.db.run(
          'DELETE FROM thumbnail_cache WHERE id = ?',
          [record.id]
        )

        // 从内存缓存删除
        const sizePart = path.basename(record.cache_path).split('_')[1]
        const size = sizePart ? sizePart.split('.')[0] : 'medium'
        const cacheKey = `${record.file_path}_${size}`
        this.thumbnailCache.delete(cacheKey)
      }

      if (expiredRecords.length > 0) {
        logger.info('过期缓存清理完成', { deleted: expiredRecords.length })
      }
    } catch (error) {
      logger.error('清理缓存失败', { error: error.message })
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 检查是否为图片文件
   */
  isImageFile(extension) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    return imageExtensions.includes(extension)
  }

  /**
   * 检查是否为视频文件
   */
  isVideoFile(extension) {
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']
    return videoExtensions.includes(extension)
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats() {
    try {
      const result = await this.db.get(`
        SELECT 
          COUNT(*) as total_count,
          COUNT(DISTINCT file_path) as unique_files
        FROM thumbnail_cache
      `)

      const stats = result
      
      // 计算缓存目录大小
      let totalSize = 0
      try {
        const files = await fs.readdir(this.cacheDir)
        for (const file of files) {
          const filePath = path.join(this.cacheDir, file)
          const stat = await fs.stat(filePath)
          totalSize += stat.size
        }
      } catch (error) {
        logger.warn('计算缓存目录大小失败', { error: error.message })
      }

      return {
        total_thumbnails: stats.total_count,
        unique_files: stats.unique_files,
        cache_size_bytes: totalSize,
        cache_size_mb: (totalSize / 1024 / 1024).toFixed(2),
        memory_cache_size: this.thumbnailCache.size
      }
    } catch (error) {
      logger.error('获取缓存统计失败', { error: error.message })
      return null
    }
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache() {
    try {
      // 删除所有缓存文件
      const files = await fs.readdir(this.cacheDir)
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file)
        await fs.unlink(filePath)
      }

      // 清空数据库缓存
      await this.db.run('DELETE FROM thumbnail_cache')

      // 清空内存缓存
      this.thumbnailCache.clear()

      logger.info('所有缓存已清空')
      return true
    } catch (error) {
      logger.error('清空缓存失败', { error: error.message })
      return false
    }
  }
}

module.exports = ThumbnailService 