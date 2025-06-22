// 用户相关类型
export interface Admin {
  id: number
  username: string
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
  remember?: boolean
}

export interface LoginResponse {
  success: boolean
  message: string
  data?: {
    admin: Admin
    accessToken: string
    refreshToken: string
  }
}

// 分享路径相关类型
export interface SharePath {
  id: number
  name: string
  description?: string
  path: string
  type: 'local' | 'smb' | 'nfs'
  accessType: 'public' | 'password'
  hasPassword?: boolean
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  smbConfig?: any
  nfsConfig?: any
}

export interface CreateShareRequest {
  name: string
  path: string
  type: 'local' | 'smb' | 'nfs'
  access_type: 'public' | 'password'
  password?: string
  smb_config?: SMBConfig
  nfs_config?: NFSConfig
}

export interface SMBConfig {
  server_ip: string
  share_name: string
  username?: string
  password?: string
  domain?: string
}

export interface NFSConfig {
  server_ip: string
  export_path: string
  mount_options?: string
}

// 文件相关类型
export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: string
  extension?: string
  mime_type?: string
  has_thumbnail?: boolean
}

export interface BrowseResponse {
  success: boolean
  message?: string
  data: {
    current_path: string
    parent_path?: string
    files: FileItem[]
    total: number
    share_info?: {
      id: number
      name: string
      type: string
    }
    pagination?: {
      limit: number
      offset: number
      total: number
      has_more: boolean
      current_page: number
      total_pages: number
    }
    // 搜索相关字段
    results?: FileItem[]
    searchTime?: number
    query?: string
  }
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
}

// 主题相关类型
export interface ThemeConfig {
  mode: 'light' | 'dark'
  primary_color: string
  custom_colors?: Record<string, string>
}

// 系统统计类型
export interface SystemStats {
  total_shares: number
  active_shares: number
  total_downloads: number
  disk_usage: number
  memory_usage: number
  cpu_usage: number
}

// 访问日志类型
export interface AccessLog {
  id: number
  shared_path_id: number
  share_name: string
  client_ip: string
  file_path?: string
  action: 'browse' | 'download'
  accessed_at: string
}

// 错误类型
export interface ApiError {
  message: string
  code?: string
  details?: any
}

// 分页参数
export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

// 文件浏览参数
export interface BrowseParams {
  path?: string
  sort?: 'name' | 'size' | 'modified'
  order?: 'asc' | 'desc'
  search?: string
  limit?: number
  offset?: number
}

// 密码验证参数
export interface PasswordVerifyRequest {
  share_id: number
  password: string
} 