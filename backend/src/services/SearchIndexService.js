const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const EventEmitter = require('events')
const logger = require('../utils/logger')

// 索引存储目录
const INDEX_DIR = path.join(__dirname, '../../../data/search-indexes')

// 确保索引目录存在
async function ensureIndexDir() {
  try {
    await fs.access(INDEX_DIR)
  } catch {
    await fs.mkdir(INDEX_DIR, { recursive: true })
    logger.info('创建搜索索引目录', { dir: INDEX_DIR })
  }
}

/**
 * 搜索索引服务
 * 核心设计：内存优先构建索引，异步保存到磁盘，支持增量更新
 */
class SearchIndexService extends EventEmitter {
  constructor() {
    super()
    
    // 内存中的索引存储（核心数据结构）
    this.indexes = new Map() // shareId -> 文件索引数组
    this.indexStatus = new Map() // shareId -> 索引状态
    this.fileHashes = new Map() // shareId -> Map(filePath -> hash)，用于变更检测
    this.directoryTimes = new Map() // shareId -> Map(dirPath -> lastModified)，目录变更检测
    
    // 服务配置
    this.config = {
      enablePersistence: true, // 启用磁盘持久化
      enableIncrementalUpdate: true, // 启用增量更新
      maxCacheAge: 5 * 60 * 1000, // 5分钟缓存过期
      incrementalCheckInterval: 2 * 60 * 1000, // 2分钟增量检查间隔
      batchSize: 50, // 文件处理批大小
      maxIndexSize: 1000000, // 最大索引文件数量（100万）
      autoCleanup: true, // 自动清理过期索引
      cleanupInterval: 30 * 60 * 1000, // 30分钟清理间隔
      fullRebuildThreshold: 0.3, // 变更超过30%时执行全量重建
      hashAlgorithm: 'md5' // 文件hash算法
    }
    
    // 初始化FileSystemService
    this.fileSystemService = null
    this.incrementalTimers = new Map() // 增量更新定时器
  }

  /**
   * 初始化服务
   */
  async init() {
    await ensureIndexDir()
    
    // 初始化FileSystemService
    const FileSystemService = require('./FileSystemService')
    this.fileSystemService = new FileSystemService()
    
    // 加载持久化的索引
    await this.loadPersistedIndexes()
    
    // 启动定期更新
    this.startPeriodicUpdate()
    
    // 启动增量更新检查
    this.startIncrementalUpdateChecks()
    
    logger.info('搜索索引服务初始化完成', {
      incrementalUpdate: this.config.enableIncrementalUpdate,
      checkInterval: this.config.incrementalCheckInterval
    })
  }

  /**
   * 启动增量更新检查
   */
  startIncrementalUpdateChecks() {
    if (!this.config.enableIncrementalUpdate) return

    // 为每个已有索引启动增量检查
    for (const shareId of this.indexes.keys()) {
      this.startIncrementalUpdateForShare(shareId)
    }

    logger.info('增量更新检查服务已启动')
  }

  /**
   * 为特定分享启动增量更新
   */
  startIncrementalUpdateForShare(shareId) {
    if (this.incrementalTimers.has(shareId)) {
      clearInterval(this.incrementalTimers.get(shareId))
    }

    const timer = setInterval(async () => {
      try {
        await this.performIncrementalUpdate(shareId)
      } catch (error) {
        logger.error('增量更新失败', { shareId, error: error.message })
      }
    }, this.config.incrementalCheckInterval)

    this.incrementalTimers.set(shareId, timer)
    logger.info('为分享启动增量更新', { shareId })
  }

  /**
   * 停止分享的增量更新
   */
  stopIncrementalUpdateForShare(shareId) {
    if (this.incrementalTimers.has(shareId)) {
      clearInterval(this.incrementalTimers.get(shareId))
      this.incrementalTimers.delete(shareId)
      logger.info('停止分享的增量更新', { shareId })
    }
  }

  /**
   * 执行增量更新
   */
  async performIncrementalUpdate(shareId) {
    const startTime = Date.now()
    logger.info('开始增量更新检查', { shareId })

    try {
      // 检查索引是否存在
      if (!this.indexes.has(shareId)) {
        logger.info('索引不存在，执行全量构建', { shareId })
        await this.buildSearchIndex(shareId)
        return
      }

      // 获取分享配置
      const Share = require('../models/Share')
      const share = await Share.findById(shareId)
      if (!share || !share.enabled) {
        logger.warn('分享不存在或已禁用，跳过增量更新', { shareId })
        return
      }

      // 检测变更
      const changes = await this.detectChanges(shareId, share)
      
      if (changes.totalChanges === 0) {
        logger.debug('未检测到变更，跳过更新', { shareId })
        return
      }

      // 判断是否需要全量重建
      const currentIndex = this.indexes.get(shareId)
      const changeRatio = changes.totalChanges / (currentIndex.length || 1)
      
      if (changeRatio > this.config.fullRebuildThreshold) {
        logger.info('变更比例超过阈值，执行全量重建', { 
          shareId, 
          changeRatio: Math.round(changeRatio * 100) + '%',
          threshold: Math.round(this.config.fullRebuildThreshold * 100) + '%'
        })
        await this.buildSearchIndex(shareId)
        return
      }

      // 执行增量更新
      await this.applyIncrementalChanges(shareId, share, changes)

      logger.info('增量更新完成', {
        shareId,
        duration: Date.now() - startTime,
        added: changes.added.length,
        modified: changes.modified.length,
        deleted: changes.deleted.length
      })

    } catch (error) {
      logger.error('增量更新失败', { shareId, error: error.message })
    }
  }

  /**
   * 检测文件变更
   */
  async detectChanges(shareId, share) {
    const changes = {
      added: [],
      modified: [],
      deleted: [],
      totalChanges: 0
    }

    try {
      // 获取当前索引和hash记录
      const currentIndex = this.indexes.get(shareId) || []
      const currentHashes = this.fileHashes.get(shareId) || new Map()
      const currentFiles = new Map(currentIndex.map(item => [item.path, item]))

      // 扫描文件系统获取最新状态
      const latestFiles = new Map()
      await this.scanForChanges(share, '', latestFiles, shareId)

      // 检测新增和修改的文件
      for (const [filePath, fileInfo] of latestFiles.entries()) {
        const currentHash = currentHashes.get(filePath)
        const newHash = this.calculateFileHash(fileInfo)

        if (!currentFiles.has(filePath)) {
          // 新增文件
          changes.added.push({
            ...fileInfo,
            hash: newHash
          })
        } else if (currentHash !== newHash) {
          // 修改的文件
          changes.modified.push({
            ...fileInfo,
            hash: newHash,
            oldHash: currentHash
          })
        }
      }

      // 检测删除的文件
      for (const [filePath, fileInfo] of currentFiles.entries()) {
        if (!latestFiles.has(filePath)) {
          changes.deleted.push(fileInfo)
        }
      }

      changes.totalChanges = changes.added.length + changes.modified.length + changes.deleted.length

      return changes
    } catch (error) {
      logger.error('检测文件变更失败', { shareId, error: error.message })
      return changes
    }
  }

  /**
   * 扫描文件系统检测变更
   */
  async scanForChanges(share, relativePath, filesMap, shareId, depth = 0) {
    const maxDepth = 20
    if (depth > maxDepth) return

    try {
      switch (share.type) {
        case 'local':
          await this.scanLocalForChanges(share.path, relativePath, filesMap, shareId, depth)
          break
        case 'smb':
          await this.scanSMBForChanges(share, relativePath, filesMap, shareId, depth)
          break
        default:
          logger.warn('不支持的分享类型用于增量更新', { shareId, type: share.type })
      }
    } catch (error) {
      logger.warn('扫描目录变更失败', { shareId, relativePath, error: error.message })
    }
  }

  /**
   * 扫描本地文件系统变更
   */
  async scanLocalForChanges(basePath, relativePath, filesMap, shareId, depth) {
    const fullPath = path.join(basePath, relativePath)
    
    try {
      const items = await fs.readdir(fullPath)
      
      for (const item of items) {
        const itemPath = path.join(fullPath, item)
        const itemRelativePath = path.join(relativePath, item).replace(/\\/g, '/')
        const stats = await fs.stat(itemPath)

        const fileInfo = {
          name: item,
          path: itemRelativePath.startsWith('/') ? itemRelativePath : '/' + itemRelativePath,
          fullPath: itemPath,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size || 0,
          modified: stats.mtime.toISOString(),
          extension: stats.isFile() ? path.extname(item).toLowerCase() : undefined,
          depth: depth,
          parentPath: relativePath || '/',
          searchableText: item.toLowerCase(),
          nameWords: this.tokenizeName(item),
          // 增量更新相关
          lastModified: stats.mtime.getTime(),
          inode: stats.ino // 用于更精确的变更检测
        }

        filesMap.set(fileInfo.path, fileInfo)

        // 递归处理子目录
        if (stats.isDirectory()) {
          await this.scanLocalForChanges(basePath, itemRelativePath, filesMap, shareId, depth + 1)
        }
      }
    } catch (error) {
      logger.debug('扫描本地目录失败', { fullPath, error: error.message })
    }
  }

  /**
   * 扫描SMB文件系统变更
   */
  async scanSMBForChanges(share, relativePath, filesMap, shareId, depth) {
    try {
      const smbConfig = share.smbConfig || await this.getSMBConfig(share.id)
      if (!smbConfig) {
        throw new Error('SMB配置不存在')
      }

      // 获取目录的最新状态
      const result = await this.fileSystemService.browseSMBDirectory(
        smbConfig,
        relativePath || '/',
        { limit: 50000, offset: 0 } // 增量检查时减少单次获取数量
      )

      const directories = []

      for (const file of result.files) {
        const fileInfo = {
          name: file.name,
          path: file.path,
          fullPath: file.path,
          type: file.type,
          size: file.size || 0,
          modified: file.modified,
          extension: file.extension,
          depth: depth,
          parentPath: relativePath || '/',
          searchableText: file.name.toLowerCase(),
          nameWords: this.tokenizeName(file.name),
          // 增量更新相关
          lastModified: new Date(file.modified).getTime()
        }

        filesMap.set(fileInfo.path, fileInfo)

        if (file.type === 'directory') {
          directories.push(file.path)
        }
      }

      // 递归处理子目录（限制并发数量）
      const concurrency = 3 // 限制并发目录扫描数量
      for (let i = 0; i < directories.length; i += concurrency) {
        const batch = directories.slice(i, i + concurrency)
        await Promise.all(batch.map(dirPath => 
          this.scanSMBForChanges(share, dirPath, filesMap, shareId, depth + 1)
        ))
      }

    } catch (error) {
      logger.warn('扫描SMB目录变更失败', { relativePath, error: error.message })
    }
  }

  /**
   * 应用增量变更（安全版本，不会丢失原索引）
   */
  async applyIncrementalChanges(shareId, share, changes) {
    const startTime = Date.now()
    
    try {
      // 获取当前索引的深拷贝，确保原索引不被修改
      const currentIndex = [...(this.indexes.get(shareId) || [])]
      const currentHashes = new Map(this.fileHashes.get(shareId) || new Map())
      
      // 备份当前状态到临时变量
      const backupIndex = [...currentIndex]
      const backupHashes = new Map(currentHashes)
      const backupStatus = { ...this.indexStatus.get(shareId) }
      
      logger.info('开始应用增量变更', {
        shareId,
        currentFiles: currentIndex.length,
        changes: {
          added: changes.added.length,
          modified: changes.modified.length,
          deleted: changes.deleted.length
        }
      })

      // 创建文件路径到索引的映射
      const indexMap = new Map(currentIndex.map((item, index) => [item.path, index]))
      let newIndex = [...currentIndex]
      let deletedCount = 0

      // 处理删除的文件（从后往前删除，避免索引偏移）
      const deletionsMap = new Map()
      for (const deletedFile of changes.deleted) {
        const index = indexMap.get(deletedFile.path)
        if (index !== undefined) {
          deletionsMap.set(index, deletedFile.path)
        }
      }
      
      // 按索引倒序删除
      const sortedDeletions = Array.from(deletionsMap.entries()).sort((a, b) => b[0] - a[0])
      for (const [index, filePath] of sortedDeletions) {
        newIndex.splice(index, 1)
        currentHashes.delete(filePath)
        deletedCount++
      }

      // 处理修改的文件
      let modifiedCount = 0
      for (const modifiedFile of changes.modified) {
        // 重新计算索引位置（因为可能有删除操作）
        const newIndexPosition = newIndex.findIndex(item => item.path === modifiedFile.path)
        if (newIndexPosition !== -1) {
          newIndex[newIndexPosition] = modifiedFile
          currentHashes.set(modifiedFile.path, modifiedFile.hash)
          modifiedCount++
        }
      }

      // 处理新增的文件
      let addedCount = 0
      for (const addedFile of changes.added) {
        newIndex.push(addedFile)
        currentHashes.set(addedFile.path, addedFile.hash)
        addedCount++
      }

      // 创建新的元数据
      const metadata = {
        status: 'completed',
        lastUpdated: Date.now(),
        progress: 100,
        totalFiles: newIndex.length,
        incrementalUpdate: true,
        lastIncrementalUpdate: Date.now(),
        changesApplied: {
          added: addedCount,
          modified: modifiedCount,
          deleted: deletedCount
        },
        buildDuration: Date.now() - startTime,
        shareId,
        indexVersion: '1.1'
      }

      // 先保存到磁盘，确保数据安全
      await this.saveIndexToDiskSync(shareId, newIndex, metadata, currentHashes)

      // 磁盘保存成功后才更新内存
      this.indexes.set(shareId, newIndex)
      this.indexStatus.set(shareId, metadata)
      this.fileHashes.set(shareId, currentHashes)

      logger.info('增量变更应用成功', {
        shareId,
        totalFiles: newIndex.length,
        duration: Date.now() - startTime,
        changes: {
          added: addedCount,
          modified: modifiedCount,
          deleted: deletedCount
        }
      })

      // 发出增量更新事件
      this.emit('incrementalUpdate', {
        shareId,
        changes: {
          added: addedCount,
          modified: modifiedCount,
          deleted: deletedCount
        },
        totalFiles: newIndex.length
      })

    } catch (error) {
      logger.error('应用增量变更失败，保持原索引不变', {
        shareId,
        error: error.message,
        duration: Date.now() - startTime
      })
      
      // 发生错误时，确保原索引数据不被破坏
      // 内存中的数据已经是安全的，因为我们使用了深拷贝
      throw error
    }
  }

  /**
   * 同步保存索引到磁盘（包含hash数据）- 增强版
   */
  async saveIndexToDiskSync(shareId, index, metadata, hashes) {
    if (!this.config.enablePersistence) return

    const startTime = Date.now()
    let tempFiles = []

    try {
      const indexPath = this.getIndexFilePath(shareId)
      const metaPath = this.getIndexMetaPath(shareId)
      const hashPath = this.getIndexHashPath(shareId)

      // 创建唯一的临时文件名，避免冲突
      const timestamp = Date.now()
      const tempIndexPath = `${indexPath}.tmp.${timestamp}`
      const tempMetaPath = `${metaPath}.tmp.${timestamp}`
      const tempHashPath = `${hashPath}.tmp.${timestamp}`
      
      tempFiles = [tempIndexPath, tempMetaPath, tempHashPath]

      logger.debug('开始保存索引到磁盘', {
        shareId,
        fileCount: index.length,
        hashCount: hashes.size,
        tempIndexPath
      })

      // 确保目录存在
      await ensureIndexDir()

      // 写入临时文件
      await fs.writeFile(tempIndexPath, JSON.stringify(index, null, 2))
      await fs.writeFile(tempMetaPath, JSON.stringify(metadata, null, 2))
      await fs.writeFile(tempHashPath, JSON.stringify(Array.from(hashes.entries()), null, 2))

      // 验证临时文件存在且可读
      await fs.access(tempIndexPath)
      await fs.access(tempMetaPath)
      await fs.access(tempHashPath)

      // 原子性重命名（先删除目标文件，避免冲突）
      try {
        await fs.unlink(indexPath).catch(() => {}) // 忽略文件不存在的错误
        await fs.unlink(metaPath).catch(() => {})
        await fs.unlink(hashPath).catch(() => {})
      } catch (unlinkError) {
        logger.debug('删除旧文件时出错（可忽略）', { error: unlinkError.message })
      }

      // 执行重命名
      await fs.rename(tempIndexPath, indexPath)
      await fs.rename(tempMetaPath, metaPath)  
      await fs.rename(tempHashPath, hashPath)

      // 验证最终文件
      await fs.access(indexPath)
      await fs.access(metaPath)
      await fs.access(hashPath)

      logger.info('索引安全保存到磁盘', {
        shareId,
        indexPath,
        fileCount: index.length,
        hashCount: hashes.size,
        duration: Date.now() - startTime
      })

      // 清空临时文件列表，避免cleanup删除成功的文件
      tempFiles = []

    } catch (error) {
      logger.error('保存索引到磁盘失败', { 
        shareId, 
        error: error.message,
        duration: Date.now() - startTime,
        tempFiles
      })

      // 清理临时文件
      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile).catch(() => {})
        } catch (cleanupError) {
          logger.debug('清理临时文件失败', { tempFile, error: cleanupError.message })
        }
      }

      throw error
    }
  }

  /**
   * 获取hash文件路径
   */
  getIndexHashPath(shareId) {
    return path.join(INDEX_DIR, `share_${shareId}_hashes.json`)
  }

  /**
   * 检查索引完整性
   */
  async checkIndexIntegrity(shareId) {
    try {
      const indexPath = this.getIndexFilePath(shareId)
      const metaPath = this.getIndexMetaPath(shareId)
      const hashPath = this.getIndexHashPath(shareId)

      const checks = {
        indexFile: false,
        metaFile: false,
        hashFile: false,
        memoryIndex: false,
        memoryHashes: false,
        consistent: false
      }

      // 检查磁盘文件
      try {
        await fs.access(indexPath)
        checks.indexFile = true
      } catch {}

      try {
        await fs.access(metaPath)
        checks.metaFile = true
      } catch {}

      try {
        await fs.access(hashPath)
        checks.hashFile = true
      } catch {}

      // 检查内存数据
      checks.memoryIndex = this.indexes.has(shareId)
      checks.memoryHashes = this.fileHashes.has(shareId)

      // 检查一致性
      if (checks.indexFile && checks.memoryIndex) {
        const diskData = await this.loadIndexFromDisk(shareId)
        const memoryIndex = this.indexes.get(shareId)
        checks.consistent = diskData && diskData.index.length === memoryIndex.length
      }

      return {
        shareId,
        checks,
        isHealthy: checks.indexFile && checks.metaFile && checks.memoryIndex,
        recommendation: this.getIntegrityRecommendation(checks)
      }
    } catch (error) {
      logger.error('检查索引完整性失败', { shareId, error: error.message })
      return {
        shareId,
        checks: {},
        isHealthy: false,
        recommendation: 'rebuild',
        error: error.message
      }
    }
  }

  /**
   * 获取完整性检查建议
   */
  getIntegrityRecommendation(checks) {
    if (!checks.indexFile || !checks.metaFile) {
      return 'rebuild' // 关键文件缺失，需要重建
    }
    
    if (!checks.hashFile) {
      return 'rebuild_hashes' // hash文件缺失，需要重建hash
    }
    
    if (!checks.memoryIndex || !checks.memoryHashes) {
      return 'reload' // 内存数据缺失，需要重新加载
    }
    
    if (!checks.consistent) {
      return 'sync' // 数据不一致，需要同步
    }
    
    return 'healthy' // 状态良好
  }

  /**
   * 修复索引完整性
   */
  async repairIndexIntegrity(shareId) {
    const integrity = await this.checkIndexIntegrity(shareId)
    
    logger.info('开始修复索引完整性', { 
      shareId, 
      recommendation: integrity.recommendation 
    })

    switch (integrity.recommendation) {
      case 'rebuild':
        await this.rebuildIndex(shareId)
        break
        
      case 'rebuild_hashes':
        // 重新计算hash但保持索引
        const index = this.indexes.get(shareId)
        if (index) {
          const hashes = this.rebuildHashesFromIndex(index)
          this.fileHashes.set(shareId, hashes)
          const metadata = this.indexStatus.get(shareId)
          await this.saveIndexToDiskSync(shareId, index, metadata, hashes)
        }
        break
        
      case 'reload':
        const diskData = await this.loadIndexFromDisk(shareId)
        if (diskData) {
          this.indexes.set(shareId, diskData.index)
          this.indexStatus.set(shareId, diskData.metadata)
          this.fileHashes.set(shareId, diskData.hashes)
        }
        break
        
      case 'sync':
        // 以磁盘数据为准，重新加载到内存
        await this.repairIndexIntegrity(shareId) // 递归调用reload逻辑
        break
        
      case 'healthy':
        logger.info('索引状态良好，无需修复', { shareId })
        break
    }

    return await this.checkIndexIntegrity(shareId)
  }

  /**
   * 计算文件hash（用于变更检测）
   */
  calculateFileHash(fileInfo) {
    const hashData = {
      path: fileInfo.path,
      size: fileInfo.size,
      modified: fileInfo.lastModified,
      type: fileInfo.type
    }
    
    if (fileInfo.inode) {
      hashData.inode = fileInfo.inode
    }
    
    return crypto
      .createHash(this.config.hashAlgorithm)
      .update(JSON.stringify(hashData))
      .digest('hex')
  }

  /**
   * 获取索引文件路径
   */
  getIndexFilePath(shareId) {
    return path.join(INDEX_DIR, `share_${shareId}.json`)
  }

  /**
   * 获取索引元数据文件路径
   */
  getIndexMetaPath(shareId) {
    return path.join(INDEX_DIR, `share_${shareId}_meta.json`)
  }

  /**
   * 保存索引到磁盘
   */
  async saveIndexToDisk(shareId, index, metadata) {
    if (!this.config.enablePersistence) return

    try {
      const indexPath = this.getIndexFilePath(shareId)
      const metaPath = this.getIndexMetaPath(shareId)

      // 保存索引数据
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2))
      
      // 保存元数据
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2))

      logger.info('索引已保存到磁盘', { 
        shareId, 
        indexPath, 
        fileCount: index.length 
      })
    } catch (error) {
      logger.error('保存索引到磁盘失败', { shareId, error: error.message })
    }
  }

  /**
   * 异步保存索引到磁盘（不阻塞主流程）
   */
  async saveIndexToDiskAsync(shareId, index, metadata) {
    if (!this.config.enablePersistence) return

    try {
      // 使用setImmediate确保在下一个事件循环中执行，不阻塞当前操作
      setImmediate(async () => {
        try {
          await this.saveIndexToDisk(shareId, index, metadata)
          logger.info('索引异步保存到磁盘完成', { shareId, fileCount: index.length })
        } catch (error) {
          logger.error('异步保存索引到磁盘失败', { shareId, error: error.message })
        }
      })
    } catch (error) {
      logger.error('启动异步保存任务失败', { shareId, error: error.message })
    }
  }

  /**
   * 从磁盘加载索引（包含hash数据）
   */
  async loadIndexFromDisk(shareId) {
    if (!this.config.enablePersistence) return null

    try {
      const indexPath = this.getIndexFilePath(shareId)
      const metaPath = this.getIndexMetaPath(shareId)
      const hashPath = this.getIndexHashPath(shareId)

      // 检查必需文件是否存在
      await fs.access(indexPath)
      await fs.access(metaPath)

      // 读取基本数据
      const indexData = await fs.readFile(indexPath, 'utf8')
      const metaData = await fs.readFile(metaPath, 'utf8')

      const index = JSON.parse(indexData)
      const metadata = JSON.parse(metaData)

      // 尝试加载hash数据（可选）
      let hashes = new Map()
      try {
        await fs.access(hashPath)
        const hashData = await fs.readFile(hashPath, 'utf8')
        const hashArray = JSON.parse(hashData)
        hashes = new Map(hashArray)
      } catch (hashError) {
        logger.debug('未找到hash文件或加载失败，将在下次全量构建时重建', { 
          shareId, 
          hashPath,
          error: hashError.message 
        })
        // 如果没有hash文件，为现有索引重新计算hash
        hashes = this.rebuildHashesFromIndex(index)
      }

      // 检查索引是否过期
      const age = Date.now() - metadata.lastUpdated
      if (age > this.config.maxCacheAge) {
        logger.info('磁盘索引已过期，将重建', { shareId, age })
        return null
      }

      logger.info('从磁盘加载索引成功', { 
        shareId, 
        fileCount: index.length,
        hashCount: hashes.size,
        age: Math.round(age / 1000) + 's'
      })

      return { index, metadata, hashes }
    } catch (error) {
      logger.debug('从磁盘加载索引失败', { shareId, error: error.message })
      return null
    }
  }

  /**
   * 从现有索引重建hash映射
   */
  rebuildHashesFromIndex(index) {
    const hashes = new Map()
    for (const item of index) {
      try {
        const hash = this.calculateFileHash(item)
        hashes.set(item.path, hash)
      } catch (error) {
        logger.debug('重建hash失败', { path: item.path, error: error.message })
      }
    }
    logger.info('从现有索引重建hash映射完成', { hashCount: hashes.size })
    return hashes
  }

  /**
   * 加载所有持久化的索引
   */
  async loadPersistedIndexes() {
    if (!this.config.enablePersistence) return

    try {
      const files = await fs.readdir(INDEX_DIR)
      const shareIds = new Set()

      // 找出所有分享ID
      for (const file of files) {
        const match = file.match(/^share_(\d+)\.json$/)
        if (match) {
          shareIds.add(parseInt(match[1]))
        }
      }

      // 加载每个分享的索引
      for (const shareId of shareIds) {
        const result = await this.loadIndexFromDisk(shareId)
        if (result) {
          this.indexes.set(shareId, result.index)
          this.indexStatus.set(shareId, result.metadata)
          this.fileHashes.set(shareId, result.hashes || new Map())
        }
      }

      logger.info('持久化索引加载完成', { 
        totalShares: shareIds.size,
        loadedShares: this.indexes.size 
      })
    } catch (error) {
      logger.error('加载持久化索引失败', { error: error.message })
    }
  }

  /**
   * 删除磁盘上的索引文件
   */
  async deleteIndexFromDisk(shareId) {
    if (!this.config.enablePersistence) return

    try {
      const indexPath = this.getIndexFilePath(shareId)
      const metaPath = this.getIndexMetaPath(shareId)
      const hashPath = this.getIndexHashPath(shareId)

      await fs.unlink(indexPath).catch(() => {}) // 忽略文件不存在的错误
      await fs.unlink(metaPath).catch(() => {})
      await fs.unlink(hashPath).catch(() => {})

      logger.info('磁盘索引文件已删除', { shareId })
    } catch (error) {
      logger.error('删除磁盘索引文件失败', { shareId, error: error.message })
    }
  }

  /**
   * 获取分享的搜索索引
   */
  async getSearchIndex(shareId) {
    // 确保服务已初始化
    if (!this.fileSystemService) {
      logger.warn('FileSystemService未初始化，正在初始化...', { shareId })
      const FileSystemService = require('./FileSystemService')
      this.fileSystemService = new FileSystemService()
    }
    
    if (!this.indexes.has(shareId)) {
      await this.buildSearchIndex(shareId)
    }
    
    const status = this.indexStatus.get(shareId)
    if (status && Date.now() - status.lastUpdated > this.config.maxCacheAge) {
      // 异步重建索引，不阻塞当前搜索
      this.buildSearchIndex(shareId).catch(error => {
        logger.error('异步重建索引失败', { shareId, error: error.message })
      })
    }
    
    return this.indexes.get(shareId) || []
  }

  /**
   * 构建搜索索引（内存优先）
   */
  async buildSearchIndex(shareId) {
    const startTime = Date.now()
    logger.info('开始构建搜索索引', { shareId })
    
    try {
      // 设置构建状态
      this.indexStatus.set(shareId, {
        status: 'building',
        lastUpdated: Date.now(),
        progress: 0,
        totalFiles: 0
      })

      // 获取分享配置
      const Share = require('../models/Share')
      const share = await Share.findById(shareId)
      if (!share || !share.enabled) {
        throw new Error('分享不存在或已禁用')
      }

      // 在内存中构建索引数组
      const index = []
      const fileHashes = new Map() // 同时构建hash映射
      let totalFiles = 0

      // 根据分享类型构建索引（全部在内存中进行）
      switch (share.type) {
        case 'local':
          await this.buildLocalIndex(share.path, '', index, shareId, 0, fileHashes)
          break
        case 'smb':
          await this.buildSMBIndex(share, '', index, shareId, 0, fileHashes)
          break
        case 'nfs':
          // TODO: 实现NFS索引构建
          logger.warn('NFS索引构建暂未实现', { shareId })
          break
        default:
          throw new Error(`不支持的分享类型: ${share.type}`)
      }

      totalFiles = index.length

      // 创建元数据
      const metadata = {
        status: 'completed',
        lastUpdated: Date.now(),
        progress: 100,
        totalFiles,
        buildDuration: Date.now() - startTime,
        shareId,
        indexVersion: '1.0'
      }

      // 先保存到磁盘，确保数据安全
      await this.saveIndexToDiskSync(shareId, index, metadata, fileHashes)

      // 磁盘保存成功后，立即存储到内存，确保搜索功能可用
      this.indexes.set(shareId, index)
      this.indexStatus.set(shareId, metadata)
      this.fileHashes.set(shareId, fileHashes) // 保存hash映射

      logger.info('索引构建并安全保存完成', { 
        shareId, 
        totalFiles, 
        duration: Date.now() - startTime 
      })

      // 启动该分享的增量更新
      if (this.config.enableIncrementalUpdate) {
        this.startIncrementalUpdateForShare(shareId)
      }

      // 发出索引完成事件
      this.emit('indexBuilt', { shareId, totalFiles })

      return index
    } catch (error) {
      logger.error('构建搜索索引失败', { shareId, error: error.message })
      
      this.indexStatus.set(shareId, {
        status: 'failed',
        lastUpdated: Date.now(),
        error: error.message
      })
      
      throw error
    }
  }

  /**
   * 构建本地文件索引（优化版）
   */
  async buildLocalIndex(dirPath, relativePath, index, shareId, depth = 0, fileHashes = null) {
    const maxDepth = 20 // 防止无限递归
    if (depth > maxDepth) return

    try {
      const items = await fs.readdir(dirPath)
      
      // 增大批处理大小以提高内存操作效率
      const batchSize = this.config.batchSize * 2 // 默认50改为100
      const batchPromises = []

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        
        const batchPromise = Promise.all(batch.map(async (item) => {
          try {
            const itemPath = path.join(dirPath, item)
            const itemRelativePath = path.join(relativePath, item).replace(/\\/g, '/')
            const stats = await fs.stat(itemPath)

            const indexItem = {
              name: item,
              path: itemRelativePath.startsWith('/') ? itemRelativePath : '/' + itemRelativePath,
              fullPath: itemPath,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size || 0,
              modified: stats.mtime.toISOString(),
              extension: stats.isFile() ? path.extname(item).toLowerCase() : undefined,
              depth: depth,
              parentPath: relativePath || '/',
              // 搜索相关字段（在内存中预计算）
              searchableText: item.toLowerCase(),
              nameWords: this.tokenizeName(item),
              // 增量更新相关
              lastModified: stats.mtime.getTime(),
              inode: stats.ino
            }

            // 直接添加到内存索引数组
            index.push(indexItem)

            // 计算并保存文件hash（用于增量更新）
            if (fileHashes) {
              const hash = this.calculateFileHash(indexItem)
              fileHashes.set(indexItem.path, hash)
            }

            // 递归处理子目录
            if (stats.isDirectory()) {
              await this.buildLocalIndex(itemPath, itemRelativePath, index, shareId, depth + 1, fileHashes)
            }
          } catch (error) {
            // 跳过无法访问的文件
            logger.debug('跳过无法访问的文件', { item, error: error.message })
          }
        }))

        batchPromises.push(batchPromise)
      }

      // 等待所有批次完成
      await Promise.all(batchPromises)

      // 更新进度（基于内存中的索引数量）
      const status = this.indexStatus.get(shareId)
      if (status && index.length > 0) {
        // 更准确的进度计算
        status.progress = Math.min(95, Math.floor((index.length / Math.max(index.length, 1000)) * 90))
        status.totalFiles = index.length
      }

    } catch (error) {
      logger.warn('读取目录失败', { dirPath, error: error.message })
    }
  }

  /**
   * 构建SMB文件索引（优化版）
   */
  async buildSMBIndex(share, relativePath, index, shareId, depth = 0, fileHashes = null) {
    const maxDepth = 20
    if (depth > maxDepth) return

    try {
      // 获取SMB配置
      const smbConfig = share.smbConfig || await this.getSMBConfig(share.id)
      if (!smbConfig) {
        throw new Error('SMB配置不存在')
      }

      // 使用FileSystemService浏览SMB目录，一次性获取更多文件
      const result = await this.fileSystemService.browseSMBDirectory(
        smbConfig, 
        relativePath || '/', 
        { limit: 20000, offset: 0 } // 增大限制，减少网络往返
      )

      // 批量处理文件，在内存中构建索引
      const directories = []
      
      for (const file of result.files) {
        const indexItem = {
          name: file.name,
          path: file.path,
          fullPath: file.path, // SMB使用虚拟路径
          type: file.type,
          size: file.size || 0,
          modified: file.modified,
          extension: file.extension,
          depth: depth,
          parentPath: relativePath || '/',
          // 搜索相关字段（在内存中预计算）
          searchableText: file.name.toLowerCase(),
          nameWords: this.tokenizeName(file.name),
          // 增量更新相关
          lastModified: new Date(file.modified).getTime()
        }

        // 直接添加到内存索引数组
        index.push(indexItem)

        // 计算并保存文件hash（用于增量更新）
        if (fileHashes) {
          const hash = this.calculateFileHash(indexItem)
          fileHashes.set(indexItem.path, hash)
        }

        // 收集需要递归处理的目录
        if (file.type === 'directory') {
          directories.push(file.path)
        }
      }

      // 批量递归处理子目录
      for (const dirPath of directories) {
        await this.buildSMBIndex(share, dirPath, index, shareId, depth + 1, fileHashes)
      }

      // 更新进度（基于内存中的索引数量）
      const status = this.indexStatus.get(shareId)
      if (status && index.length > 0) {
        status.progress = Math.min(95, Math.floor((index.length / Math.max(index.length, 1000)) * 90))
        status.totalFiles = index.length
      }

    } catch (error) {
      logger.warn('读取SMB目录失败', { relativePath, error: error.message })
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(shareId, query, options = {}) {
    const {
      limit = 100,
      offset = 0,
      extensions = [],
      type = 'all', // 'all', 'file', 'directory'
      sortBy = 'relevance', // 'relevance', 'name', 'size', 'modified'
      sortOrder = 'desc'
    } = options

    const startTime = Date.now()
    
    try {
      // 获取搜索索引（内存优先）
      const index = await this.getSearchIndex(shareId)
      if (!index || index.length === 0) {
        return {
          results: [],
          total: 0,
          pagination: {
            limit,
            offset,
            total: 0,
            has_more: false
          },
          searchTime: Date.now() - startTime
        }
      }

      // 在内存中执行搜索算法
      const results = this.performSearch(index, query, { extensions, type })
      
      // 排序
      this.sortSearchResults(results, sortBy, sortOrder)

      // 分页
      const total = results.length
      const paginatedResults = results.slice(offset, offset + limit)

      return {
        results: paginatedResults,
        total,
        pagination: {
          limit,
          offset,
          total,
          has_more: offset + limit < total
        },
        searchTime: Date.now() - startTime
      }
    } catch (error) {
      logger.error('搜索文件失败', { shareId, query, error: error.message })
      throw error
    }
  }

  /**
   * 执行搜索算法（内存搜索）
   */
  performSearch(index, query, options = {}) {
    const { extensions, type } = options
    const queryLower = query.toLowerCase()
    const queryWords = this.tokenizeName(query)
    const results = []

    for (const item of index) {
      // 类型过滤
      if (type !== 'all' && item.type !== type) {
        continue
      }

      // 扩展名过滤
      if (extensions.length > 0 && item.type === 'file') {
        if (!extensions.includes(item.extension)) {
          continue
        }
      }

      // 计算相关性得分
      const relevance = this.calculateRelevance(item, queryLower, queryWords)
      
      if (relevance > 0) {
        results.push({
          ...item,
          relevance
        })
      }
    }

    return results
  }

  /**
   * 计算搜索相关性得分
   */
  calculateRelevance(item, queryLower, queryWords) {
    const itemName = item.searchableText
    let score = 0

    // 完全匹配 (100分)
    if (itemName === queryLower) {
      score += 100
    }
    // 开头匹配 (50分)
    else if (itemName.startsWith(queryLower)) {
      score += 50
    }
    // 包含匹配 (20分)
    else if (itemName.includes(queryLower)) {
      score += 20
    }

    // 词汇匹配（每个词30分）
    for (const word of queryWords) {
      if (item.nameWords.includes(word)) {
        score += 30
      }
    }

    // 文件类型加权
    if (item.type === 'file') {
      score += 5
    }

    return score
  }

  /**
   * 排序搜索结果
   */
  sortSearchResults(results, sortBy, sortOrder) {
    const multiplier = sortOrder === 'desc' ? -1 : 1

    results.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'relevance':
          comparison = (a.relevance || 0) - (b.relevance || 0)
          break
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = (a.size || 0) - (b.size || 0)
          break
        case 'modified':
          comparison = new Date(a.modified) - new Date(b.modified)
          break
        default:
          comparison = (a.relevance || 0) - (b.relevance || 0)
      }

      return comparison * multiplier
    })
  }

  /**
   * 分词处理
   */
  tokenizeName(name) {
    return name.toLowerCase()
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ') // 保留字母、数字、中文
      .split(/\s+/)
      .filter(word => word.length > 0)
  }

  /**
   * 获取SMB配置
   */
  async getSMBConfig(shareId) {
    try {
      const db = require('../config/database')
      const query = `
        SELECT sc.* FROM smb_configs sc
        JOIN shared_paths sp ON sc.shared_path_id = sp.id
        JOIN shares s ON s.path_id = sp.id
        WHERE s.id = ?
      `
      const [rows] = await db.execute(query, [shareId])
      return rows[0] || null
    } catch (error) {
      logger.error('获取SMB配置失败', { shareId, error: error.message })
      return null
    }
  }

  /**
   * 获取索引状态
   */
  getIndexStatus(shareId) {
    return this.indexStatus.get(shareId) || {
      status: 'not_built',
      lastUpdated: null,
      progress: 0,
      totalFiles: 0
    }
  }

  /**
   * 重建索引
   */
  async rebuildIndex(shareId) {
    // 停止增量更新
    this.stopIncrementalUpdateForShare(shareId)
    
    // 清除内存中的索引
    this.indexes.delete(shareId)
    this.indexStatus.delete(shareId)
    this.fileHashes.delete(shareId)
    
    // 删除磁盘上的索引
    await this.deleteIndexFromDisk(shareId)
    
    // 重新构建
    return this.buildSearchIndex(shareId)
  }

  /**
   * 手动触发增量更新
   */
  async triggerIncrementalUpdate(shareId) {
    if (!this.config.enableIncrementalUpdate) {
      throw new Error('增量更新功能未启用')
    }
    
    return this.performIncrementalUpdate(shareId)
  }

  /**
   * 获取增量更新统计信息
   */
  getIncrementalUpdateStats(shareId) {
    const status = this.indexStatus.get(shareId)
    if (!status) {
      return null
    }

    return {
      shareId,
      isIncrementalEnabled: this.config.enableIncrementalUpdate,
      hasIncrementalTimer: this.incrementalTimers.has(shareId),
      lastUpdate: status.lastUpdated,
      lastIncrementalUpdate: status.lastIncrementalUpdate,
      changesApplied: status.changesApplied,
      checkInterval: this.config.incrementalCheckInterval,
      fullRebuildThreshold: this.config.fullRebuildThreshold
    }
  }

  /**
   * 配置增量更新参数
   */
  configureIncrementalUpdate(options = {}) {
    const {
      enabled = this.config.enableIncrementalUpdate,
      checkInterval = this.config.incrementalCheckInterval,
      fullRebuildThreshold = this.config.fullRebuildThreshold
    } = options

    // 更新配置
    const oldEnabled = this.config.enableIncrementalUpdate
    this.config.enableIncrementalUpdate = enabled
    this.config.incrementalCheckInterval = checkInterval
    this.config.fullRebuildThreshold = fullRebuildThreshold

    // 如果启用状态改变，重新配置定时器
    if (enabled !== oldEnabled) {
      if (enabled) {
        this.startIncrementalUpdateChecks()
      } else {
        // 停止所有增量更新定时器
        for (const shareId of this.incrementalTimers.keys()) {
          this.stopIncrementalUpdateForShare(shareId)
        }
      }
    } else if (enabled) {
      // 如果间隔时间改变，重启定时器
      for (const shareId of this.indexes.keys()) {
        this.startIncrementalUpdateForShare(shareId)
      }
    }

    logger.info('增量更新配置已更新', {
      enabled,
      checkInterval,
      fullRebuildThreshold
    })

    return {
      enabled: this.config.enableIncrementalUpdate,
      checkInterval: this.config.incrementalCheckInterval,
      fullRebuildThreshold: this.config.fullRebuildThreshold
    }
  }

  /**
   * 启动定期更新任务
   */
  startPeriodicUpdate() {
    if (!this.config.autoCleanup) return

    setInterval(() => {
      this.cleanupExpiredIndexes().catch(error => {
        logger.error('定期清理索引失败', { error: error.message })
      })
    }, this.config.cleanupInterval)

    logger.info('搜索索引定期更新任务已启动')
  }

  /**
   * 清理过期索引
   */
  async cleanupExpiredIndexes() {
    const now = Date.now()
    const expiredShareIds = []

    for (const [shareId, status] of this.indexStatus.entries()) {
      if (now - status.lastUpdated > this.config.maxCacheAge * 10) { // 10倍过期时间
        expiredShareIds.push(shareId)
      }
    }

    for (const shareId of expiredShareIds) {
      await this.deleteIndexFromDisk(shareId)
      this.indexes.delete(shareId)
      this.indexStatus.delete(shareId)
    }

    if (expiredShareIds.length > 0) {
      logger.info('清理过期索引完成', { count: expiredShareIds.length })
    }
  }

  /**
   * 清理孤立的索引文件
   */
  async cleanupOrphanIndexFiles() {
    try {
      const files = await fs.readdir(INDEX_DIR)
      const Share = require('../models/Share')
      const shares = await Share.findAll()
      const validShareIds = new Set(shares.map(s => s.id))

      for (const file of files) {
        const match = file.match(/^share_(\d+)(_meta)?\.json$/)
        if (match) {
          const shareId = parseInt(match[1])
          if (!validShareIds.has(shareId)) {
            const filePath = path.join(INDEX_DIR, file)
            await fs.unlink(filePath)
            logger.info('删除孤立索引文件', { file })
          }
        }
      }
    } catch (error) {
      logger.error('清理孤立索引文件失败', { error: error.message })
    }
  }
}

// 单例模式
let searchIndexService = null

/**
 * 获取搜索索引服务实例
 */
function getSearchIndexService() {
  if (!searchIndexService) {
    searchIndexService = new SearchIndexService()
  }
  return searchIndexService
}

module.exports = {
  SearchIndexService,
  getSearchIndexService
}