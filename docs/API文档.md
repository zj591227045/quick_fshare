# Quick FShare - API 接口文档

## 概述

Quick FShare 提供 RESTful API 接口，支持文件分享管理、用户认证、文件浏览等功能。

## 基础信息

- **基础URL**: `http://localhost:3000/api`
- **版本**: v1
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

## 认证

### 获取Token

大部分API需要在请求头中携带JWT Token：

```http
Authorization: Bearer <your-jwt-token>
```

## API 接口规范

### 响应格式

所有API响应采用统一格式：

```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

错误响应格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### HTTP状态码

- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未授权
- `403` - 禁止访问
- `404` - 资源不存在
- `500` - 服务器内部错误

## 认证相关 API

### 1. 管理员登录

**POST** `/api/auth/login`

管理员登录获取访问令牌。

#### 请求参数

```json
{
  "username": "admin",
  "password": "password123"
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  },
  "message": "登录成功"
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "用户名或密码错误"
  }
}
```

### 2. 刷新Token

**POST** `/api/auth/refresh`

使用刷新令牌获取新的访问令牌。

#### 请求参数

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  },
  "message": "Token刷新成功"
}
```

### 3. 验证Token

**GET** `/api/auth/verify`

验证当前Token是否有效。

#### 请求头

```http
Authorization: Bearer <token>
```

#### 响应

```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  },
  "message": "Token有效"
}
```

### 4. 登出

**POST** `/api/auth/logout`

登出并废弃当前Token。

#### 请求头

```http
Authorization: Bearer <token>
```

#### 响应

```json
{
  "success": true,
  "message": "登出成功"
}
```

## 分享管理 API

### 1. 获取分享列表

**GET** `/api/shares`

获取所有分享路径列表。

#### 请求头

```http
Authorization: Bearer <token>
```

#### 查询参数

- `page` (可选): 页码，默认为1
- `limit` (可选): 每页数量，默认为10
- `type` (可选): 分享类型 (local, smb, nfs)
- `enabled` (可选): 是否启用 (true, false)

#### 响应

```json
{
  "success": true,
  "data": {
    "shares": [
      {
        "id": 1,
        "name": "本地文档",
        "path": "/home/user/documents",
        "type": "local",
        "accessType": "public",
        "enabled": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": 2,
        "name": "SMB共享",
        "path": "\\\\192.168.1.100\\share",
        "type": "smb",
        "accessType": "password",
        "enabled": true,
        "smbConfig": {
          "serverIp": "192.168.1.100",
          "shareName": "share",
          "username": "user",
          "domain": "workgroup"
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "pages": 1
    }
  },
  "message": "获取成功"
}
```

### 2. 创建分享

**POST** `/api/shares`

创建新的分享路径。

#### 请求头

```http
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求参数

本地分享：
```json
{
  "name": "本地文档",
  "path": "/home/user/documents",
  "type": "local",
  "accessType": "public"
}
```

SMB分享：
```json
{
  "name": "SMB共享",
  "path": "\\\\192.168.1.100\\share",
  "type": "smb",
  "accessType": "password",
  "password": "1234",
  "smbConfig": {
    "serverIp": "192.168.1.100",
    "shareName": "share",
    "username": "user",
    "password": "smbpassword",
    "domain": "workgroup"
  }
}
```

NFS分享：
```json
{
  "name": "NFS共享",
  "path": "/mnt/nfs",
  "type": "nfs",
  "accessType": "public",
  "nfsConfig": {
    "serverIp": "192.168.1.100",
    "exportPath": "/export/data",
    "mountOptions": "vers=3,proto=tcp"
  }
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "本地文档",
    "path": "/home/user/documents",
    "type": "local",
    "accessType": "public",
    "enabled": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "分享创建成功"
}
```

### 3. 更新分享

**PUT** `/api/shares/:id`

更新指定的分享路径。

#### 请求头

```http
Authorization: Bearer <token>
Content-Type: application/json
```

#### 路径参数

- `id`: 分享ID

#### 请求参数

```json
{
  "name": "更新的分享名称",
  "accessType": "password",
  "password": "5678",
  "enabled": false
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "更新的分享名称",
    "path": "/home/user/documents",
    "type": "local",
    "accessType": "password",
    "enabled": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  },
  "message": "分享更新成功"
}
```

### 4. 删除分享

**DELETE** `/api/shares/:id`

删除指定的分享路径。

#### 请求头

```http
Authorization: Bearer <token>
```

#### 路径参数

- `id`: 分享ID

#### 响应

```json
{
  "success": true,
  "message": "分享删除成功"
}
```

### 5. 测试分享连接

**POST** `/api/shares/test-connection`

测试分享路径的连接性。

#### 请求头

```http
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求参数

```json
{
  "type": "smb",
  "smbConfig": {
    "serverIp": "192.168.1.100",
    "shareName": "share",
    "username": "user",
    "password": "password",
    "domain": "workgroup"
  }
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "connected": true,
    "responseTime": 123,
    "message": "连接成功"
  }
}
```

## 文件浏览 API

### 1. 浏览文件

**GET** `/api/browse/:shareId`

浏览指定分享的文件和文件夹。

#### 路径参数

- `shareId`: 分享ID

#### 查询参数

- `path` (可选): 子路径，默认为根目录
- `sort` (可选): 排序方式 (name, size, modified)
- `order` (可选): 排序顺序 (asc, desc)
- `page` (可选): 页码
- `limit` (可选): 每页数量

#### 响应

```json
{
  "success": true,
  "data": {
    "share": {
      "id": 1,
      "name": "本地文档",
      "type": "local",
      "accessType": "public"
    },
    "currentPath": "/documents/photos",
    "items": [
      {
        "name": "folder1",
        "type": "directory",
        "size": 0,
        "modified": "2024-01-01T00:00:00.000Z",
        "permissions": "drwxr-xr-x"
      },
      {
        "name": "image1.jpg",
        "type": "file",
        "size": 1024000,
        "modified": "2024-01-01T00:00:00.000Z",
        "permissions": "-rw-r--r--",
        "mimeType": "image/jpeg",
        "hasThumbnail": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 10,
      "pages": 1
    }
  },
  "message": "获取成功"
}
```

### 2. 验证密码保护的分享

**POST** `/api/browse/verify-password`

验证密码保护分享的访问密码。

#### 请求参数

```json
{
  "shareId": 1,
  "password": "1234"
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  },
  "message": "密码验证成功"
}
```

### 3. 搜索文件

**GET** `/api/browse/:shareId/search`

在指定分享中搜索文件。

#### 路径参数

- `shareId`: 分享ID

#### 查询参数

- `q`: 搜索关键词
- `path` (可选): 搜索路径
- `type` (可选): 文件类型 (file, directory)
- `extension` (可选): 文件扩展名

#### 响应

```json
{
  "success": true,
  "data": {
    "query": "photo",
    "results": [
      {
        "name": "photo1.jpg",
        "path": "/documents/photos/photo1.jpg",
        "type": "file",
        "size": 1024000,
        "modified": "2024-01-01T00:00:00.000Z",
        "mimeType": "image/jpeg",
        "hasThumbnail": true
      }
    ],
    "total": 1
  },
  "message": "搜索完成"
}
```

## 文件下载 API

### 1. 下载文件

**GET** `/api/download/:shareId/*`

下载指定分享中的文件。

#### 路径参数

- `shareId`: 分享ID
- `*`: 文件路径

#### 查询参数

- `download` (可选): 强制下载 (true/false)

#### 响应

文件流响应，包含以下响应头：

```http
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="filename.ext"
Content-Length: 1024000
```

### 2. 获取文件信息

**HEAD** `/api/download/:shareId/*`

获取文件的元信息，不下载文件内容。

#### 路径参数

- `shareId`: 分享ID
- `*`: 文件路径

#### 响应头

```http
Content-Type: image/jpeg
Content-Length: 1024000
Last-Modified: Mon, 01 Jan 2024 00:00:00 GMT
ETag: "abc123"
```

## 缩略图 API

### 1. 获取缩略图

**GET** `/api/thumbnail/:shareId/*`

获取图片文件的缩略图。

#### 路径参数

- `shareId`: 分享ID
- `*`: 图片文件路径

#### 查询参数

- `size` (可选): 缩略图尺寸 (small, medium, large)，默认medium
- `quality` (可选): 图片质量 (1-100)，默认80

#### 响应

图片文件流，包含缓存头：

```http
Content-Type: image/webp
Cache-Control: public, max-age=31536000
ETag: "thumbnail-abc123"
```

### 2. 批量获取缩略图

**POST** `/api/thumbnail/batch`

批量获取多个图片文件的缩略图信息。

#### 请求参数

```json
{
  "items": [
    {
      "shareId": 1,
      "path": "/photos/image1.jpg"
    },
    {
      "shareId": 1,
      "path": "/photos/image2.jpg"
    }
  ],
  "size": "medium"
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "thumbnails": [
      {
        "shareId": 1,
        "path": "/photos/image1.jpg",
        "url": "/api/thumbnail/1/photos/image1.jpg?size=medium",
        "available": true
      },
      {
        "shareId": 1,
        "path": "/photos/image2.jpg",
        "url": "/api/thumbnail/1/photos/image2.jpg?size=medium",
        "available": false,
        "error": "Unsupported file type"
      }
    ]
  },
  "message": "获取成功"
}
```

## 系统配置 API

### 1. 获取系统配置

**GET** `/api/config`

获取系统配置信息。

#### 请求头

```http
Authorization: Bearer <token>
```

#### 响应

```json
{
  "success": true,
  "data": {
    "theme": {
      "mode": "light",
      "primaryColor": "#1890ff",
      "customColors": {}
    },
    "upload": {
      "maxFileSize": 104857600,
      "allowedTypes": ["image/*", "video/*", "application/pdf"]
    },
    "thumbnail": {
      "enabled": true,
      "sizes": {
        "small": 150,
        "medium": 300,
        "large": 600
      },
      "quality": 80
    }
  },
  "message": "获取成功"
}
```

### 2. 更新系统配置

**PUT** `/api/config`

更新系统配置。

#### 请求头

```http
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求参数

```json
{
  "theme": {
    "mode": "dark",
    "primaryColor": "#722ed1"
  },
  "thumbnail": {
    "quality": 90
  }
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "theme": {
      "mode": "dark",
      "primaryColor": "#722ed1",
      "customColors": {}
    },
    "thumbnail": {
      "enabled": true,
      "sizes": {
        "small": 150,
        "medium": 300,
        "large": 600
      },
      "quality": 90
    }
  },
  "message": "配置更新成功"
}
```

## 系统信息 API

### 1. 获取系统状态

**GET** `/api/system/status`

获取系统运行状态。

#### 响应

```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "uptime": 86400,
    "memory": {
      "used": 134217728,
      "total": 2147483648
    },
    "disk": {
      "used": 10737418240,
      "total": 107374182400
    },
    "shares": {
      "total": 5,
      "active": 4
    }
  },
  "message": "获取成功"
}
```

### 2. 获取访问统计

**GET** `/api/system/stats`

获取访问统计信息。

#### 请求头

```http
Authorization: Bearer <token>
```

#### 查询参数

- `period` (可选): 统计周期 (day, week, month)
- `shareId` (可选): 指定分享ID

#### 响应

```json
{
  "success": true,
  "data": {
    "period": "day",
    "totalViews": 1234,
    "totalDownloads": 567,
    "topFiles": [
      {
        "path": "/documents/file1.pdf",
        "downloads": 45,
        "views": 123
      }
    ],
    "hourlyStats": [
      {
        "hour": "2024-01-01T00:00:00.000Z",
        "views": 12,
        "downloads": 5
      }
    ]
  },
  "message": "获取成功"
}
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| INVALID_CREDENTIALS | 用户名或密码错误 |
| TOKEN_EXPIRED | Token已过期 |
| TOKEN_INVALID | Token无效 |
| INSUFFICIENT_PERMISSIONS | 权限不足 |
| SHARE_NOT_FOUND | 分享不存在 |
| FILE_NOT_FOUND | 文件不存在 |
| PATH_NOT_ACCESSIBLE | 路径无法访问 |
| CONNECTION_FAILED | 连接失败 |
| INVALID_PASSWORD | 密码错误 |
| FILE_TOO_LARGE | 文件过大 |
| UNSUPPORTED_FILE_TYPE | 不支持的文件类型 |
| RATE_LIMIT_EXCEEDED | 请求频率超限 |
| VALIDATION_ERROR | 参数验证错误 |
| INTERNAL_ERROR | 内部服务器错误 |

## SDK 示例

### JavaScript/TypeScript 示例

```typescript
// API客户端类
class QuickFShareAPI {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  // 设置认证token
  setToken(token: string) {
    this.token = token
  }

  // 登录
  async login(username: string, password: string) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })
    
    const data = await response.json()
    if (data.success) {
      this.setToken(data.data.token)
    }
    return data
  }

  // 获取分享列表
  async getShares() {
    const response = await fetch(`${this.baseURL}/shares`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })
    return await response.json()
  }

  // 浏览文件
  async browseFiles(shareId: number, path: string = '') {
    const url = new URL(`${this.baseURL}/browse/${shareId}`)
    if (path) {
      url.searchParams.set('path', path)
    }
    
    const response = await fetch(url.toString())
    return await response.json()
  }

  // 下载文件
  async downloadFile(shareId: number, filePath: string) {
    const response = await fetch(`${this.baseURL}/download/${shareId}/${filePath}`)
    return response.blob()
  }
}

// 使用示例
const api = new QuickFShareAPI('http://localhost:3000/api')

// 登录
await api.login('admin', 'password')

// 获取分享列表
const shares = await api.getShares()

// 浏览文件
const files = await api.browseFiles(1, '/documents')

// 下载文件
const fileBlob = await api.downloadFile(1, 'document.pdf')
```

## 注意事项

1. **认证**: 除了公开分享的浏览和下载功能外，所有API都需要认证
2. **速率限制**: API有速率限制，默认每分钟100次请求
3. **文件大小**: 下载文件有大小限制，默认最大100MB
4. **缓存**: 缩略图和文件信息会被缓存，提高性能
5. **安全**: 所有密码都经过加密存储，不会在API响应中返回
6. **CORS**: 开发环境下启用CORS，生产环境需要配置合适的CORS策略 