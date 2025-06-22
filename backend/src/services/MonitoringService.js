const os = require('os')
const fs = require('fs').promises
const path = require('path')
const { execSync } = require('child_process')
const logger = require('../utils/logger')
const DatabaseManager = require('../config/database')

class MonitoringService {
  constructor() {
    this.db = new DatabaseManager()
    this.metrics = new Map()
    this.alertThresholds = {
      cpu: 80,           // CPU使用率阈值 (%)
      memory: 80,        // 内存使用率阈值 (%)
      disk: 90,          // 磁盘使用率阈值 (%)
      errorRate: 5,      // 错误率阈值 (%)
      responseTime: 5000 // 响应时间阈值 (ms)
    }
    this.collectionInterval = 60000 // 1分钟收集一次
    this.retentionDays = 30 // 保留30天的数据
    this.isCollecting = false
    
    this.init()
  }

  async init() {
    try {
      await this.db.connect()
      logger.info('监控服务初始化成功')
    } catch (error) {
      logger.error('监控服务初始化失败', { error: error.message })
    }
  }

  /**
   * 开始收集系统指标
   */
  startCollection() {
    if (this.isCollecting) {
      logger.warn('监控服务已在运行')
      return
    }

    this.isCollecting = true
    this.collectionTimer = setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error) {
        logger.error('收集系统指标失败', { error: error.message })
      }
    }, this.collectionInterval)

    logger.info('系统监控已启动', { interval: this.collectionInterval })
  }

  /**
   * 停止收集系统指标
   */
  stopCollection() {
    if (!this.isCollecting) {
      return
    }

    this.isCollecting = false
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer)
      this.collectionTimer = null
    }

    logger.info('系统监控已停止')
  }

  /**
   * 收集所有系统指标
   */
  async collectMetrics() {
    try {
      const timestamp = new Date().toISOString()
      
      // 收集系统基础指标
      const systemMetrics = await this.getSystemMetrics()
      
      // 收集应用指标
      const appMetrics = await this.getApplicationMetrics()
      
      // 收集数据库指标
      const dbMetrics = await this.getDatabaseMetrics()
      
      // 收集访问统计
      const accessStats = await this.getAccessStats()

      const allMetrics = {
        timestamp,
        ...systemMetrics,
        ...appMetrics,
        ...dbMetrics,
        ...accessStats
      }

      // 存储到内存
      this.metrics.set(timestamp, allMetrics)

      // 存储到数据库
      await this.storeMetrics(allMetrics)

      // 检查告警
      await this.checkAlerts(allMetrics)

      // 清理过期数据
      await this.cleanupOldMetrics()

      logger.debug('系统指标收集完成', { timestamp })
    } catch (error) {
      logger.error('收集系统指标失败', { error: error.message })
    }
  }

  /**
   * 获取系统基础指标
   */
  async getSystemMetrics() {
    try {
      // CPU信息
      const cpus = os.cpus()
      const cpuUsage = await this.getCpuUsage()

      // 内存信息
      const totalMemory = os.totalmem()
      const freeMemory = os.freemem()
      const usedMemory = totalMemory - freeMemory
      const memoryUsage = (usedMemory / totalMemory) * 100

      // 磁盘信息
      const diskUsage = await this.getDiskUsage()

      // 网络信息
      const networkInterfaces = os.networkInterfaces()
      const networkStats = await this.getNetworkStats()

      // 系统负载
      const loadAverage = os.loadavg()

      return {
        system: {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          uptime: os.uptime(),
          load_average: {
            '1m': loadAverage[0],
            '5m': loadAverage[1],
            '15m': loadAverage[2]
          }
        },
        cpu: {
          count: cpus.length,
          model: cpus[0]?.model || 'Unknown',
          usage: cpuUsage,
          speed: cpus[0]?.speed || 0
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usage_percentage: Math.round(memoryUsage * 100) / 100,
          available: freeMemory
        },
        disk: diskUsage,
        network: {
          interfaces: Object.keys(networkInterfaces).length,
          stats: networkStats
        }
      }
    } catch (error) {
      logger.error('获取系统指标失败', { error: error.message })
      return {}
    }
  }

  /**
   * 获取CPU使用率
   */
  async getCpuUsage() {
    try {
      // 在Linux/macOS上使用top命令
      if (os.platform() !== 'win32') {
        const output = execSync('top -l 1 -n 0 | grep "CPU usage"').toString()
        const match = output.match(/(\d+\.?\d*)%\s+user/)
        return match ? parseFloat(match[1]) : 0
      } else {
        // Windows上使用wmic
        const output = execSync('wmic cpu get loadpercentage /value').toString()
        const match = output.match(/LoadPercentage=(\d+)/)
        return match ? parseFloat(match[1]) : 0
      }
    } catch (error) {
      // 如果命令失败，返回进程CPU使用率的近似值
      const usage = process.cpuUsage()
      return Math.round((usage.user + usage.system) / 10000) / 100
    }
  }

  /**
   * 获取磁盘使用情况
   */
  async getDiskUsage() {
    try {
      const dataDir = path.join(process.cwd(), 'data')
      
      let diskInfo = {}
      
      if (os.platform() !== 'win32') {
        // Unix-like系统使用df命令
        try {
          const output = execSync(`df -h "${dataDir}"`).toString()
          const lines = output.split('\n')
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/)
            diskInfo = {
              total: parts[1],
              used: parts[2],
              available: parts[3],
              usage_percentage: parseFloat(parts[4].replace('%', ''))
            }
          }
        } catch (error) {
          // 如果df命令失败，使用基本的文件系统信息
          const stats = await fs.stat(dataDir).catch(() => null)
          if (stats) {
            diskInfo = {
              total: 'Unknown',
              used: 'Unknown',
              available: 'Unknown',
              usage_percentage: 0
            }
          }
        }
      } else {
        // Windows系统
        try {
          const drive = process.cwd().substring(0, 2)
          const output = execSync(`wmic logicaldisk where caption="${drive}" get size,freespace /value`).toString()
          const sizeMatch = output.match(/Size=(\d+)/)
          const freeMatch = output.match(/FreeSpace=(\d+)/)
          
          if (sizeMatch && freeMatch) {
            const total = parseInt(sizeMatch[1])
            const free = parseInt(freeMatch[1])
            const used = total - free
            
            diskInfo = {
              total: this.formatBytes(total),
              used: this.formatBytes(used),
              available: this.formatBytes(free),
              usage_percentage: Math.round((used / total) * 100)
            }
          }
        } catch (error) {
          diskInfo = {
            total: 'Unknown',
            used: 'Unknown',
            available: 'Unknown',
            usage_percentage: 0
          }
        }
      }

      return diskInfo
    } catch (error) {
      logger.error('获取磁盘使用情况失败', { error: error.message })
      return {
        total: 'Unknown',
        used: 'Unknown',
        available: 'Unknown',
        usage_percentage: 0
      }
    }
  }

  /**
   * 获取网络统计信息
   */
  async getNetworkStats() {
    try {
      // 这里可以集成更详细的网络监控
      // 目前返回基本信息
      return {
        connections: 0,
        bytes_sent: 0,
        bytes_received: 0
      }
    } catch (error) {
      logger.error('获取网络统计失败', { error: error.message })
      return {
        connections: 0,
        bytes_sent: 0,
        bytes_received: 0
      }
    }
  }

  /**
   * 获取应用指标
   */
  async getApplicationMetrics() {
    try {
      const memUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()
      
      return {
        application: {
          node_version: process.version,
          pid: process.pid,
          uptime: process.uptime(),
          memory: {
            rss: memUsage.rss,
            heap_total: memUsage.heapTotal,
            heap_used: memUsage.heapUsed,
            external: memUsage.external,
            array_buffers: memUsage.arrayBuffers
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          event_loop_lag: this.getEventLoopLag()
        }
      }
    } catch (error) {
      logger.error('获取应用指标失败', { error: error.message })
      return {}
    }
  }

  /**
   * 获取事件循环延迟
   */
  getEventLoopLag() {
    const start = process.hrtime.bigint()
    setImmediate(() => {
      const delta = process.hrtime.bigint() - start
      return Number(delta) / 1000000 // 转换为毫秒
    })
    return 0 // 简化实现
  }

  /**
   * 获取数据库指标
   */
  async getDatabaseMetrics() {
    try {
      // 数据库大小
      const dbSize = await this.getDatabaseSize()
      
      // 表统计
      const tableStats = await this.getTableStats()
      
      // 连接状态
      const connectionHealth = await this.db.healthCheck()

      return {
        database: {
          size_bytes: dbSize,
          size_mb: Math.round(dbSize / 1024 / 1024 * 100) / 100,
          tables: tableStats,
          connection_healthy: connectionHealth,
          last_backup: await this.getLastBackupTime()
        }
      }
    } catch (error) {
      logger.error('获取数据库指标失败', { error: error.message })
      return {}
    }
  }

  /**
   * 获取数据库大小
   */
  async getDatabaseSize() {
    try {
      const dbPath = path.join(process.cwd(), 'data', 'quick_fshare.db')
      const stats = await fs.stat(dbPath)
      return stats.size
    } catch (error) {
      return 0
    }
  }

  /**
   * 获取表统计信息
   */
  async getTableStats() {
    try {
      const tables = ['admins', 'shared_paths', 'access_logs', 'download_records', 'thumbnail_cache']
      const stats = {}

      for (const table of tables) {
        try {
          const result = await this.db.query(`SELECT COUNT(*) as count FROM ${table}`)
          stats[table] = result[0].count
        } catch (error) {
          stats[table] = 0
        }
      }

      return stats
    } catch (error) {
      logger.error('获取表统计失败', { error: error.message })
      return {}
    }
  }

  /**
   * 获取最后备份时间
   */
  async getLastBackupTime() {
    try {
      const backupDir = path.join(process.cwd(), 'data', 'backups')
      const files = await fs.readdir(backupDir).catch(() => [])
      
      if (files.length === 0) {
        return null
      }

      const backupFiles = files.filter(file => file.endsWith('.db'))
      if (backupFiles.length === 0) {
        return null
      }

      // 获取最新的备份文件
      let latestTime = 0
      for (const file of backupFiles) {
        const filePath = path.join(backupDir, file)
        const stats = await fs.stat(filePath)
        if (stats.mtime.getTime() > latestTime) {
          latestTime = stats.mtime.getTime()
        }
      }

      return latestTime > 0 ? new Date(latestTime).toISOString() : null
    } catch (error) {
      return null
    }
  }

  /**
   * 获取访问统计
   */
  async getAccessStats() {
    try {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // 最近1小时的访问量
      const hourlyAccess = await this.db.query(
        'SELECT COUNT(*) as count FROM access_logs WHERE accessed_at > ?',
        [oneHourAgo.toISOString()]
      )

      // 最近24小时的访问量
      const dailyAccess = await this.db.query(
        'SELECT COUNT(*) as count FROM access_logs WHERE accessed_at > ?',
        [oneDayAgo.toISOString()]
      )

      // 最近1小时的下载量
      const hourlyDownloads = await this.db.query(
        'SELECT COUNT(*) as count FROM download_records WHERE downloaded_at > ?',
        [oneHourAgo.toISOString()]
      )

      // 最近24小时的下载量
      const dailyDownloads = await this.db.query(
        'SELECT COUNT(*) as count FROM download_records WHERE downloaded_at > ?',
        [oneDayAgo.toISOString()]
      )

      // 热门分享路径
      const popularShares = await this.db.query(`
        SELECT sp.name, COUNT(*) as access_count 
        FROM access_logs al 
        JOIN shared_paths sp ON al.shared_path_id = sp.id 
        WHERE al.accessed_at > ? 
        GROUP BY sp.id 
        ORDER BY access_count DESC 
        LIMIT 5
      `, [oneDayAgo.toISOString()])

      return {
        access_stats: {
          hourly_access: hourlyAccess[0].count,
          daily_access: dailyAccess[0].count,
          hourly_downloads: hourlyDownloads[0].count,
          daily_downloads: dailyDownloads[0].count,
          popular_shares: popularShares
        }
      }
    } catch (error) {
      logger.error('获取访问统计失败', { error: error.message })
      return {}
    }
  }

  /**
   * 存储指标到数据库
   */
  async storeMetrics(metrics) {
    try {
      // 创建系统指标表（如果不存在）
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS system_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          cpu_usage REAL,
          memory_usage REAL,
          disk_usage REAL,
          load_average_1m REAL,
          load_average_5m REAL,
          load_average_15m REAL,
          network_connections INTEGER,
          app_memory_used INTEGER,
          app_uptime REAL,
          db_size INTEGER,
          hourly_access INTEGER,
          daily_access INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // 插入指标数据
      await this.db.query(`
        INSERT INTO system_metrics (
          timestamp, cpu_usage, memory_usage, disk_usage,
          load_average_1m, load_average_5m, load_average_15m,
          network_connections, app_memory_used, app_uptime,
          db_size, hourly_access, daily_access
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        metrics.timestamp,
        metrics.cpu?.usage || 0,
        metrics.memory?.usage_percentage || 0,
        metrics.disk?.usage_percentage || 0,
        metrics.system?.load_average?.['1m'] || 0,
        metrics.system?.load_average?.['5m'] || 0,
        metrics.system?.load_average?.['15m'] || 0,
        metrics.network?.stats?.connections || 0,
        metrics.application?.memory?.heap_used || 0,
        metrics.application?.uptime || 0,
        metrics.database?.size_bytes || 0,
        metrics.access_stats?.hourly_access || 0,
        metrics.access_stats?.daily_access || 0
      ])
    } catch (error) {
      logger.error('存储系统指标失败', { error: error.message })
    }
  }

  /**
   * 检查告警
   */
  async checkAlerts(metrics) {
    try {
      const alerts = []

      // CPU使用率告警
      if (metrics.cpu?.usage > this.alertThresholds.cpu) {
        alerts.push({
          type: 'cpu_high',
          level: 'warning',
          message: `CPU使用率过高: ${metrics.cpu.usage}%`,
          value: metrics.cpu.usage,
          threshold: this.alertThresholds.cpu
        })
      }

      // 内存使用率告警
      if (metrics.memory?.usage_percentage > this.alertThresholds.memory) {
        alerts.push({
          type: 'memory_high',
          level: 'warning',
          message: `内存使用率过高: ${metrics.memory.usage_percentage}%`,
          value: metrics.memory.usage_percentage,
          threshold: this.alertThresholds.memory
        })
      }

      // 磁盘使用率告警
      if (metrics.disk?.usage_percentage > this.alertThresholds.disk) {
        alerts.push({
          type: 'disk_high',
          level: 'critical',
          message: `磁盘使用率过高: ${metrics.disk.usage_percentage}%`,
          value: metrics.disk.usage_percentage,
          threshold: this.alertThresholds.disk
        })
      }

      // 记录告警
      for (const alert of alerts) {
        logger.warn('系统告警', alert)
        await this.recordAlert(alert)
      }
    } catch (error) {
      logger.error('检查告警失败', { error: error.message })
    }
  }

  /**
   * 记录告警到数据库
   */
  async recordAlert(alert) {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS system_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          value REAL,
          threshold REAL,
          resolved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP
        )
      `)

      await this.db.query(`
        INSERT INTO system_alerts (type, level, message, value, threshold)
        VALUES (?, ?, ?, ?, ?)
      `, [alert.type, alert.level, alert.message, alert.value, alert.threshold])
    } catch (error) {
      logger.error('记录告警失败', { error: error.message })
    }
  }

  /**
   * 清理过期指标数据
   */
  async cleanupOldMetrics() {
    try {
      const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000)
      
      // 清理数据库中的过期数据
      await this.db.query(
        'DELETE FROM system_metrics WHERE created_at < ?',
        [cutoffDate.toISOString()]
      )

      // 清理内存中的过期数据
      for (const [timestamp] of this.metrics) {
        if (new Date(timestamp) < cutoffDate) {
          this.metrics.delete(timestamp)
        }
      }
    } catch (error) {
      logger.error('清理过期指标失败', { error: error.message })
    }
  }

  /**
   * 获取当前系统状态
   */
  async getCurrentStats() {
    try {
      return await this.getSystemMetrics()
    } catch (error) {
      logger.error('获取当前系统状态失败', { error: error.message })
      return {}
    }
  }

  /**
   * 获取历史指标数据
   */
  async getHistoricalMetrics(hours = 24) {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
      
      const result = await this.db.query(`
        SELECT * FROM system_metrics 
        WHERE created_at > ? 
        ORDER BY created_at DESC
      `, [startTime.toISOString()])

      return result
    } catch (error) {
      logger.error('获取历史指标失败', { error: error.message })
      return []
    }
  }

  /**
   * 格式化字节大小
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 设置告警阈值
   */
  setAlertThresholds(thresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds }
    logger.info('告警阈值已更新', this.alertThresholds)
  }

  /**
   * 获取告警历史
   */
  async getAlerts(limit = 50) {
    try {
      const result = await this.db.query(`
        SELECT * FROM system_alerts 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit])

      return result
    } catch (error) {
      logger.error('获取告警历史失败', { error: error.message })
      return []
    }
  }
}

module.exports = new MonitoringService() 