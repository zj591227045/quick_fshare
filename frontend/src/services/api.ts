import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { getApiConfig, ApiConfig } from '@/utils/apiConfig'
import {
  LoginRequest,
  LoginResponse,
  ApiResponse,
  SharePath,
  CreateShareRequest,
  BrowseResponse,
  BrowseParams,
  PasswordVerifyRequest,
  SystemStats,
  AccessLog,
  PaginationParams,
  ThemeConfig,
} from '@/types'



class ApiClient {
  private client: AxiosInstance
  private refreshing = false
  private failedQueue: Array<{
    resolve: (token: string) => void
    reject: (error: any) => void
  }> = []
  private apiConfig: ApiConfig | null = null

  constructor() {
    // 使用临时配置创建client，稍后会更新
    this.client = axios.create({
      baseURL: '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
    this.initializeConfig()
  }

  /**
   * 异步初始化配置
   */
  private async initializeConfig() {
    try {
      this.apiConfig = await getApiConfig()
      
      // 更新axios实例的配置
      this.client.defaults.baseURL = this.apiConfig.baseURL
      this.client.defaults.timeout = this.apiConfig.timeout
      
      console.log('✅ API客户端配置完成:', {
        baseURL: this.apiConfig.baseURL,
        environment: this.apiConfig.environment
      })
    } catch (error) {
      console.error('❌ API配置初始化失败:', error)
    }
  }

  /**
   * 获取当前API配置信息
   */
  getApiInfo() {
    return {
      config: this.apiConfig,
      currentBaseURL: this.client.defaults.baseURL,
      isConfigured: this.apiConfig !== null
    }
  }

  /**
   * 手动重新配置API
   */
  async reconfigure(newBaseUrl?: string) {
    try {
      const { apiConfigManager } = await import('@/utils/apiConfig')
      this.apiConfig = await apiConfigManager.reconfigure(newBaseUrl)
      this.client.defaults.baseURL = this.apiConfig.baseURL
      console.log('✅ API重新配置成功:', this.apiConfig.baseURL)
    } catch (error) {
      console.error('❌ API重新配置失败:', error)
      throw error
    }
  }

  private setupInterceptors() {
    // 请求拦截器 - 添加认证token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器 - 处理token刷新
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // 如果是浏览相关的请求，不处理401错误，让组件自己处理
        if (originalRequest.skipAuth401 && error.response?.status === 401) {
          return Promise.reject(error)
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.refreshing) {
            // 如果正在刷新token，将请求放入队列
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject })
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`
                return this.client(originalRequest)
              })
              .catch((err) => Promise.reject(err))
          }

          originalRequest._retry = true
          this.refreshing = true

          try {
            const refreshToken = localStorage.getItem('refresh_token')
            if (!refreshToken) {
              throw new Error('No refresh token')
            }

            const response = await this.client.post('/auth/refresh', {
              refreshToken,
            })

            if (response.data.success && response.data.data?.accessToken) {
              const newToken = response.data.data.accessToken
              localStorage.setItem('access_token', newToken)

              // 处理队列中的请求
              this.failedQueue.forEach(({ resolve }) => resolve(newToken))
              this.failedQueue = []

              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            // 刷新失败，清除token并跳转到登录页
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('admin_data')
            
            this.failedQueue.forEach(({ reject }) => reject(refreshError))
            this.failedQueue = []

            window.location.href = '/login'
            return Promise.reject(refreshError)
          } finally {
            this.refreshing = false
          }
        }

        return Promise.reject(error)
      }
    )
  }

  private async request<T = any>(config: AxiosRequestConfig & { skipAuth401?: boolean }): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client(config)
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data
      }
      return {
        success: false,
        message: error.message || '网络请求失败',
      }
    }
  }

  // 认证相关API
  auth = {
    login: (data: LoginRequest): Promise<LoginResponse> =>
      this.request<LoginResponse['data']>({
        method: 'POST',
        url: '/auth/login',
        data,
      }),

    logout: (refreshToken: string): Promise<ApiResponse> =>
      this.request({
        method: 'POST',
        url: '/auth/logout',
        data: { refreshToken },
      }),

    refresh: (refreshToken: string): Promise<ApiResponse<{ accessToken: string }>> =>
      this.request({
        method: 'POST',
        url: '/auth/refresh',
        data: { refreshToken },
      }),

    verify: (token?: string): Promise<ApiResponse> =>
      this.request({
        method: 'GET',
        url: '/auth/verify',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),

    changePassword: (data: { currentPassword: string; newPassword: string }): Promise<ApiResponse> =>
      this.request({
        method: 'PUT',
        url: '/auth/password',
        data,
      }),

    getProfile: (): Promise<ApiResponse<{ admin: any }>> =>
      this.request({
        method: 'GET',
        url: '/auth/profile',
      }),
  }

  // 分享路径管理API
  shares = {
    list: (params?: PaginationParams): Promise<ApiResponse<{ shares: SharePath[]; total: number }>> =>
      this.request({
        method: 'GET',
        url: '/shares',
        params,
      }),

    get: (id: number): Promise<ApiResponse<SharePath>> =>
      this.request({
        method: 'GET',
        url: `/shares/${id}`,
      }),

    create: (data: CreateShareRequest): Promise<ApiResponse<SharePath>> =>
      this.request({
        method: 'POST',
        url: '/shares',
        data,
      }),

    update: (id: number, data: Partial<CreateShareRequest>): Promise<ApiResponse<SharePath>> =>
      this.request({
        method: 'PUT',
        url: `/shares/${id}`,
        data,
      }),

    delete: (id: number): Promise<ApiResponse> =>
      this.request({
        method: 'DELETE',
        url: `/shares/${id}`,
      }),

    toggle: (id: number): Promise<ApiResponse<SharePath>> =>
      this.request({
        method: 'POST',
        url: `/shares/${id}/toggle`,
      }),

    testConnection: (data: { type: 'smb' | 'nfs'; config: any }): Promise<ApiResponse> =>
      this.request({
        method: 'POST',
        url: '/shares/test-connection',
        data,
      }),

    getStats: (): Promise<ApiResponse<any>> =>
      this.request({
        method: 'GET',
        url: '/shares/stats',
      }),

    getShareStats: (id: number): Promise<ApiResponse<any>> =>
      this.request({
        method: 'GET',
        url: `/shares/${id}/stats`,
      }),

    getEnabledShares: (): Promise<ApiResponse<{ shares: any[] }>> =>
      this.request({
        method: 'GET',
        url: '/shares/enabled',
      }),
  }

  // 文件浏览API
  browse = {
    list: (shareId: string | number, params?: BrowseParams): Promise<BrowseResponse> =>
      this.request({
        method: 'GET',
        url: `/browse/${shareId}`,
        params,
        skipAuth401: true, // 跳过401拦截，让组件自己处理密码验证
      }) as Promise<BrowseResponse>,

    verifyPassword: (data: PasswordVerifyRequest): Promise<ApiResponse<{ token: string }>> =>
      this.request({
        method: 'POST',
        url: '/browse/verify-password',
        data,
      }),

    download: (shareId: string | number, filePath: string, token?: string): string => {
      const params = new URLSearchParams()
      if (token) params.append('token', token)
      return `/api/browse/${shareId}/download${filePath}?${params.toString()}`
    },

    getThumbnail: (shareId: string | number, filePath: string, token?: string): string => {
      const params = new URLSearchParams()
      if (token) params.append('token', token)
      return `/api/thumbnail/${shareId}/${encodeURIComponent(filePath)}?${params.toString()}`
    },

    search: (shareId: string | number, params: {
      q: string;
      extensions?: string;
      type?: 'all' | 'file' | 'directory';
      sort?: 'relevance' | 'name' | 'size' | 'modified';
      order?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      token?: string;
    }): Promise<BrowseResponse> =>
      this.request({
        method: 'GET',
        url: `/browse/${shareId}/search`,
        params,
        skipAuth401: true, // 跳过401拦截，让组件自己处理密码验证
      }) as Promise<BrowseResponse>,

    getSearchStatus: (shareId: string | number): Promise<ApiResponse<any>> =>
      this.request({
        method: 'GET',
        url: `/browse/${shareId}/search-status`,
      }),

    rebuildIndex: (shareId: string | number): Promise<ApiResponse<any>> =>
      this.request({
        method: 'POST',
        url: `/browse/${shareId}/rebuild-index`,
      }),
  }

  // 系统配置API
  config = {
    getTheme: (): Promise<ApiResponse<ThemeConfig>> =>
      this.request({
        method: 'GET',
        url: '/config/theme',
      }),

    updateTheme: (data: Partial<ThemeConfig>): Promise<ApiResponse<ThemeConfig>> =>
      this.request({
        method: 'PUT',
        url: '/config/theme',
        data,
      }),

    getSettings: (): Promise<ApiResponse<any>> =>
      this.request({
        method: 'GET',
        url: '/config/settings',
      }),

    updateSettings: (data: any): Promise<ApiResponse<any>> =>
      this.request({
        method: 'PUT',
        url: '/config/settings',
        data,
      }),
  }

  // 系统监控API
  system = {
    getStats: (): Promise<ApiResponse<SystemStats>> =>
      this.request({
        method: 'GET',
        url: '/system/stats',
      }),

    getLogs: (params?: PaginationParams & { level?: string; start_date?: string; end_date?: string }): Promise<ApiResponse<{ logs: AccessLog[]; total: number }>> =>
      this.request({
        method: 'GET',
        url: '/system/logs',
        params,
      }),

    getAccessLogs: (params?: PaginationParams & { share_id?: number; action?: string }): Promise<ApiResponse<{ logs: AccessLog[]; total: number }>> =>
      this.request({
        method: 'GET',
        url: '/system/access-logs',
        params,
      }),

    cleanupLogs: (days?: number): Promise<ApiResponse> =>
      this.request({
        method: 'POST',
        url: '/system/cleanup-logs',
        data: { days },
      }),

    getHealth: (): Promise<ApiResponse<any>> =>
      this.request({
        method: 'GET',
        url: '/system/health',
      }),
  }

  // 文件上传API (用于头像等)
  upload = {
    single: (file: File, type: string = 'general'): Promise<ApiResponse<{ url: string; filename: string }>> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      return this.request({
        method: 'POST',
        url: '/upload',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 上传文件超时时间更长
      })
    },
  }
}

// 创建API客户端实例
const apiClient = new ApiClient()

// 导出各个模块的API
export const authApi = apiClient.auth
export const sharesApi = apiClient.shares
export const browseApi = apiClient.browse
export const configApi = apiClient.config
export const systemApi = apiClient.system
export const uploadApi = apiClient.upload

export default apiClient 