const logger = require('../utils/logger')
const MonitoringService = require('../services/MonitoringService')
const ThumbnailService = require('../services/ThumbnailService')
const dbManager = require('../config/database')

class SystemController {
  constructor() {
    this.db = dbManager
    this.thumbnailService = new ThumbnailService()
    this.monitoringService = new MonitoringService()
  }

  /**
   * 获取系统状态概览
   */
  async getSystemStats(req, res) {
    try {
      // 获取当前系统状态
      const currentStats = await this.monitoringService.getCurrentStats()
      
      // 获取数据库统计
      const dbStats = await this.getDatabaseStats()
      
      // 获取访问统计
      const accessStats = await this.getAccessStats()
      
      // 获取缩略图缓存统计
      const thumbnailStats = await this.thumbnailService.getCacheStats()

      res.json({
        success: true,
        data: {
          system: currentStats,
          database: dbStats,
          access: accessStats,
          thumbnail_cache: thumbnailStats,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      logger.error('获取系统状态失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '获取系统状态失败'
      })
    }
  }

  /**
   * 获取系统历史指标
   */
  async getHistoricalMetrics(req, res) {
    try {
      const hours = parseInt(req.query.hours) || 24
      const metrics = await this.monitoringService.getHistoricalMetrics(hours)

      res.json({
        success: true,
        data: {
          metrics,
          hours,
          total_points: metrics.length
        }
      })
    } catch (error) {
      logger.error('获取历史指标失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '获取历史指标失败'
      })
    }
  }

  /**
   * 获取系统日志
   */
  async getSystemLogs(req, res) {
    try {
      const {
        level,
        start_date,
        end_date,
        limit = 100,
        offset = 0
      } = req.query

      let whereConditions = []
      let params = []

      if (level) {
        whereConditions.push('level = ?')
        params.push(level)
      }

      if (start_date) {
        whereConditions.push('timestamp >= ?')
        params.push(new Date(start_date).toISOString())
      }

      if (end_date) {
        whereConditions.push('timestamp <= ?')
        params.push(new Date(end_date).toISOString())
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // 获取日志数据
      const logs = await this.db.all(`
        SELECT * FROM system_logs 
        ${whereClause}
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)])

      // 获取总数
      const totalResult = await this.db.get(`
        SELECT COUNT(*) as total FROM system_logs 
        ${whereClause}
      `, params)

      const total = totalResult.total

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: parseInt(offset) + parseInt(limit) < total
          }
        }
      })
    } catch (error) {
      logger.error('获取系统日志失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '获取系统日志失败'
      })
    }
  }

  /**
   * 获取访问日志
   */
  async getAccessLogs(req, res) {
    try {
      const {
        share_id,
        action,
        start_date,
        end_date,
        limit = 100,
        offset = 0
      } = req.query

      let whereConditions = []
      let params = []

      if (share_id) {
        whereConditions.push('al.shared_path_id = ?')
        params.push(parseInt(share_id))
      }

      if (action) {
        whereConditions.push('al.action = ?')
        params.push(action)
      }

      if (start_date) {
        whereConditions.push('al.accessed_at >= ?')
        params.push(new Date(start_date).toISOString())
      }

      if (end_date) {
        whereConditions.push('al.accessed_at <= ?')
        params.push(new Date(end_date).toISOString())
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // 获取访问日志
      const logs = await this.db.all(`
        SELECT 
          al.*,
          sp.name as share_name,
          sp.type as share_type
        FROM access_logs al
        LEFT JOIN shared_paths sp ON al.shared_path_id = sp.id
        ${whereClause}
        ORDER BY al.accessed_at DESC 
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)])

      // 获取总数
      const totalResult = await this.db.get(`
        SELECT COUNT(*) as total 
        FROM access_logs al
        LEFT JOIN shared_paths sp ON al.shared_path_id = sp.id
        ${whereClause}
      `, params)

      const total = totalResult.total

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: parseInt(offset) + parseInt(limit) < total
          }
        }
      })
    } catch (error) {
      logger.error('获取访问日志失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '获取访问日志失败'
      })
    }
  }

  /**
   * 获取下载记录
   */
  async getDownloadRecords(req, res) {
    try {
      const {
        share_id,
        start_date,
        end_date,
        limit = 100,
        offset = 0
      } = req.query

      let whereConditions = []
      let params = []

      if (share_id) {
        whereConditions.push('dr.shared_path_id = ?')
        params.push(parseInt(share_id))
      }

      if (start_date) {
        whereConditions.push('dr.downloaded_at >= ?')
        params.push(new Date(start_date).toISOString())
      }

      if (end_date) {
        whereConditions.push('dr.downloaded_at <= ?')
        params.push(new Date(end_date).toISOString())
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // 获取下载记录
      const records = await this.db.all(`
        SELECT 
          dr.*,
          sp.name as share_name,
          sp.type as share_type
        FROM download_records dr
        LEFT JOIN shared_paths sp ON dr.shared_path_id = sp.id
        ${whereClause}
        ORDER BY dr.downloaded_at DESC 
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)])

      // 获取总数
      const totalResult = await this.db.get(`
        SELECT COUNT(*) as total 
        FROM download_records dr
        LEFT JOIN shared_paths sp ON dr.shared_path_id = sp.id
        ${whereClause}
      `, params)

      const total = totalResult.total

      res.json({
        success: true,
        data: {
          records,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: parseInt(offset) + parseInt(limit) < total
          }
        }
      })
    } catch (error) {
      logger.error('获取下载记录失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '获取下载记录失败'
      })
    }
  }

  /**
   * 获取系统告警
   */
  async getSystemAlerts(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50
      const alerts = await this.monitoringService.getAlerts(limit)

      res.json({
        success: true,
        data: {
          alerts,
          total: alerts.length
        }
      })
    } catch (error) {
      logger.error('获取系统告警失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '获取系统告警失败'
      })
    }
  }

  /**
   * 清理日志
   */
  async cleanupLogs(req, res) {
    try {
      const { days = 30 } = req.body
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      // 清理访问日志
      const accessResult = await this.db.run(
        'DELETE FROM access_logs WHERE accessed_at < ?',
        [cutoffDate.toISOString()]
      )

      // 清理下载记录
      const downloadResult = await this.db.run(
        'DELETE FROM download_records WHERE downloaded_at < ?',
        [cutoffDate.toISOString()]
      )

      // 清理系统指标
      const metricsResult = await this.db.run(
        'DELETE FROM system_metrics WHERE created_at < ?',
        [cutoffDate.toISOString()]
      )

      logger.info('日志清理完成', {
        days,
        deleted_access_logs: accessResult.changes,
        deleted_download_records: downloadResult.changes,
        deleted_metrics: metricsResult.changes
      })

      res.json({
        success: true,
        message: '日志清理完成',
        data: {
          days,
          deleted: {
            access_logs: accessResult.changes || 0,
            download_records: downloadResult.changes || 0,
            system_metrics: metricsResult.changes || 0
          }
        }
      })
    } catch (error) {
      logger.error('清理日志失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '清理日志失败'
      })
    }
  }

  /**
   * 清理缩略图缓存
   */
  async cleanupThumbnails(req, res) {
    try {
      const success = await this.thumbnailService.clearAllCache()

      if (success) {
        logger.info('缩略图缓存清理完成')
        res.json({
          success: true,
          message: '缩略图缓存清理完成'
        })
      } else {
        res.status(500).json({
          success: false,
          message: '缩略图缓存清理失败'
        })
      }
    } catch (error) {
      logger.error('清理缩略图缓存失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '清理缩略图缓存失败'
      })
    }
  }

  /**
   * 获取系统健康状态
   */
  async getHealthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {}
      }

      // 检查数据库连接
      try {
        await this.db.connect()
        const result = await this.db.healthCheck()
        health.services.database = {
          status: result ? 'healthy' : 'unhealthy',
          connected: result
        }
      } catch (error) {
        health.services.database = {
          status: 'error',
          error: error.message
        }
        health.status = 'degraded'
      }

      // 检查监控服务
      health.services.monitoring = {
        status: this.monitoringService.isCollecting ? 'running' : 'stopped',
        collecting: this.monitoringService.isCollecting
      }

      // 检查磁盘空间
      try {
        const diskUsage = await this.monitoringService.getDiskUsage()
        health.services.disk = {
          status: diskUsage.usage_percentage < 90 ? 'healthy' : 'warning',
          usage_percentage: diskUsage.usage_percentage
        }
        
        if (diskUsage.usage_percentage >= 95) {
          health.status = 'critical'
        } else if (diskUsage.usage_percentage >= 90) {
          health.status = 'warning'
        }
      } catch (error) {
        health.services.disk = {
          status: 'error',
          error: error.message
        }
      }

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'warning' || health.status === 'degraded' ? 200 : 503

      res.status(statusCode).json({
        success: true,
        data: health
      })
    } catch (error) {
      logger.error('健康检查失败', { error: error.message })
      res.status(503).json({
        success: false,
        message: '系统健康检查失败',
        data: {
          status: 'critical',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      })
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats() {
    try {
      await this.db.connect()
      
      const tables = ['admins', 'shared_paths', 'access_logs', 'download_records', 'thumbnail_cache']
      const stats = {}

      for (const table of tables) {
        try {
          const result = await this.db.get(`SELECT COUNT(*) as count FROM ${table}`)
          stats[table] = result.count
        } catch (error) {
          stats[table] = 0
        }
      }

      return stats
    } catch (error) {
      logger.error('获取数据库统计失败', { error: error.message })
      return {}
    }
  }

  /**
   * 获取访问统计信息
   */
  async getAccessStats() {
    try {
      await this.db.connect()
      
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // 各时间段访问量
      const hourlyAccess = await this.db.get(
        'SELECT COUNT(*) as count FROM access_logs WHERE accessed_at > ?',
        [oneHourAgo.toISOString()]
      )

      const dailyAccess = await this.db.get(
        'SELECT COUNT(*) as count FROM access_logs WHERE accessed_at > ?',
        [oneDayAgo.toISOString()]
      )

      const weeklyAccess = await this.db.get(
        'SELECT COUNT(*) as count FROM access_logs WHERE accessed_at > ?',
        [oneWeekAgo.toISOString()]
      )

      // 各时间段下载量
      const hourlyDownloads = await this.db.get(
        'SELECT COUNT(*) as count FROM download_records WHERE downloaded_at > ?',
        [oneHourAgo.toISOString()]
      )

      const dailyDownloads = await this.db.get(
        'SELECT COUNT(*) as count FROM download_records WHERE downloaded_at > ?',
        [oneDayAgo.toISOString()]
      )

      const weeklyDownloads = await this.db.get(
        'SELECT COUNT(*) as count FROM download_records WHERE downloaded_at > ?',
        [oneWeekAgo.toISOString()]
      )

      // 热门分享
      const popularShares = await this.db.all(`
        SELECT 
          sp.name,
          sp.id,
          COUNT(*) as access_count 
        FROM access_logs al 
        JOIN shared_paths sp ON al.shared_path_id = sp.id 
        WHERE al.accessed_at > ? 
        GROUP BY sp.id 
        ORDER BY access_count DESC 
        LIMIT 10
      `, [oneWeekAgo.toISOString()])

      return {
        hourly: {
          access: hourlyAccess.count,
          downloads: hourlyDownloads.count
        },
        daily: {
          access: dailyAccess.count,
          downloads: dailyDownloads.count
        },
        weekly: {
          access: weeklyAccess.count,
          downloads: weeklyDownloads.count
        },
        popular_shares: popularShares
      }
    } catch (error) {
      logger.error('获取访问统计失败', { error: error.message })
      return {}
    }
  }

  /**
   * 启动系统监控
   */
  async startMonitoring(req, res) {
    try {
      this.monitoringService.startCollection()
      
      res.json({
        success: true,
        message: '系统监控已启动'
      })
    } catch (error) {
      logger.error('启动系统监控失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '启动系统监控失败'
      })
    }
  }

  /**
   * 停止系统监控
   */
  async stopMonitoring(req, res) {
    try {
      this.monitoringService.stopCollection()
      
      res.json({
        success: true,
        message: '系统监控已停止'
      })
    } catch (error) {
      logger.error('停止系统监控失败', { error: error.message })
      res.status(500).json({
        success: false,
        message: '停止系统监控失败'
      })
    }
  }
}

module.exports = SystemController 