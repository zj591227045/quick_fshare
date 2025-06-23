/**
 * API配置管理工具
 * 智能检测环境并提供正确的API配置
 */

export interface ApiConfig {
  baseURL: string
  timeout: number
  environment: string
  isDevelopment: boolean
  isProduction: boolean
  isContainer: boolean
}

/**
 * 环境检测工具
 */
class EnvironmentDetector {
  /**
   * 检测是否为开发环境
   */
  static isDevelopment(): boolean {
    return (
      (import.meta as any).env?.DEV === true ||
      (import.meta as any).env?.MODE === 'development' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.port === '5173' || // Vite默认开发端口
      location.port === '3000' || // 常见开发端口
      location.port === '8080'    // 另一个常见开发端口
    )
  }

  /**
   * 检测是否为生产环境
   */
  static isProduction(): boolean {
    return (import.meta as any).env?.PROD === true || 
           (import.meta as any).env?.MODE === 'production'
  }

  /**
   * 检测是否在容器环境中
   */
  static isContainer(): boolean {
    return (
      location.port === '80' || 
      location.port === '443' ||
      location.port === '' ||
      (!this.isDevelopment() && location.hostname !== 'localhost')
    )
  }

  /**
   * 获取当前环境信息
   */
  static getEnvironmentInfo() {
    return {
      isDevelopment: this.isDevelopment(),
      isProduction: this.isProduction(),
      isContainer: this.isContainer(),
      hostname: location.hostname,
      port: location.port,
      protocol: location.protocol,
      mode: (import.meta as any).env?.MODE || 'unknown'
    }
  }
}

/**
 * API URL生成器
 */
class ApiUrlGenerator {
  /**
   * 生成API基础URL
   */
  static generateBaseUrl(): string {
    // 1. 优先使用环境变量
    const envBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL
    if (envBaseUrl) {
      console.log('🔧 使用环境变量API地址:', envBaseUrl)
      return envBaseUrl
    }

    // 2. 根据环境自动判断
    const env = EnvironmentDetector.getEnvironmentInfo()
    
    if (env.isDevelopment && !env.isContainer) {
      // 开发环境：直接连接到后端端口
      const baseUrl = `${env.protocol}//${env.hostname}:3001/api`
      console.log('🛠️  开发环境API地址:', baseUrl)
      return baseUrl
    } else {
      // 生产/容器环境：使用相对路径，通过nginx代理
      const baseUrl = '/api'
      console.log('🐳 生产/容器环境API地址:', baseUrl)
      return baseUrl
    }
  }

  /**
   * 获取备用URL列表
   */
  static getFallbackUrls(): string[] {
    const env = EnvironmentDetector.getEnvironmentInfo()
    
    return [
      '/api',                                         // nginx代理
      `${env.protocol}//${env.hostname}:3001/api`,   // 直连后端（当前主机）
      'http://localhost:3001/api',                   // localhost直连
      'http://127.0.0.1:3001/api',                   // 127.0.0.1直连
      'https://localhost:3001/api',                  // https localhost
    ].filter((url, index, arr) => arr.indexOf(url) === index) // 去重
  }
}

/**
 * API健康检查器
 */
class ApiHealthChecker {
  /**
   * 检查API健康状态
   */
  static async checkHealth(baseUrl: string, timeout = 5000): Promise<boolean> {
    try {
      const healthUrl = baseUrl.replace('/api', '') + '/api/health'
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache'
      })
      
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      console.warn(`⚠️  API健康检查失败 (${baseUrl}):`, error)
      return false
    }
  }

  /**
   * 查找可用的API URL
   */
  static async findAvailableUrl(urls: string[]): Promise<string | null> {
    for (const url of urls) {
      console.log('🔍 检查API地址:', url)
      const isHealthy = await this.checkHealth(url)
      
      if (isHealthy) {
        console.log('✅ API地址可用:', url)
        return url
      }
    }
    
    console.error('❌ 所有API地址都不可用')
    return null
  }
}

/**
 * API配置管理器
 */
export class ApiConfigManager {
  private static instance: ApiConfigManager
  private config: ApiConfig | null = null

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ApiConfigManager {
    if (!this.instance) {
      this.instance = new ApiConfigManager()
    }
    return this.instance
  }

  /**
   * 初始化配置
   */
  async initialize(): Promise<ApiConfig> {
    if (this.config) {
      return this.config
    }

    const env = EnvironmentDetector.getEnvironmentInfo()
    let baseURL = ApiUrlGenerator.generateBaseUrl()

    // 验证API可用性并尝试备用地址
    const isHealthy = await ApiHealthChecker.checkHealth(baseURL)
    if (!isHealthy) {
      console.warn('⚠️  默认API地址不可用，尝试备用地址...')
      const fallbackUrls = ApiUrlGenerator.getFallbackUrls()
      const availableUrl = await ApiHealthChecker.findAvailableUrl(fallbackUrls)
      
      if (availableUrl) {
        baseURL = availableUrl
      } else {
        console.error('❌ 无法找到可用的API地址，将使用默认配置')
      }
    }

    this.config = {
      baseURL,
      timeout: 30000,
      environment: env.mode,
      isDevelopment: env.isDevelopment,
      isProduction: env.isProduction,
      isContainer: env.isContainer
    }

    console.log('🎯 API配置初始化完成:', this.config)
    return this.config
  }

  /**
   * 获取当前配置
   */
  getConfig(): ApiConfig | null {
    return this.config
  }

  /**
   * 重新配置API地址
   */
  async reconfigure(newBaseUrl?: string): Promise<ApiConfig> {
    if (newBaseUrl) {
      const isHealthy = await ApiHealthChecker.checkHealth(newBaseUrl)
      if (!isHealthy) {
        throw new Error(`指定的API地址不可用: ${newBaseUrl}`)
      }
    }

    this.config = null
    return this.initialize()
  }

  /**
   * 获取环境信息
   */
  getEnvironmentInfo() {
    return EnvironmentDetector.getEnvironmentInfo()
  }

  /**
   * 获取调试信息
   */
  getDebugInfo() {
    return {
      config: this.config,
      environment: this.getEnvironmentInfo(),
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 导出默认实例
 */
export const apiConfigManager = ApiConfigManager.getInstance()

/**
 * 快捷方法：获取API配置
 */
export async function getApiConfig(): Promise<ApiConfig> {
  return apiConfigManager.initialize()
} 