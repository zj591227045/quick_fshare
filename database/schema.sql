-- Quick FShare 数据库结构
-- SQLite 数据库表结构定义

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分享路径表
CREATE TABLE IF NOT EXISTS shared_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    path VARCHAR(500) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('local', 'smb', 'nfs')),
    access_type VARCHAR(20) DEFAULT 'public' CHECK (access_type IN ('public', 'password')),
    password VARCHAR(255),
    enabled BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMB连接配置表
CREATE TABLE IF NOT EXISTS smb_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shared_path_id INTEGER NOT NULL,
    server_ip VARCHAR(45) NOT NULL,
    port INTEGER DEFAULT 445,
    share_name VARCHAR(100) NOT NULL,
    username VARCHAR(50),
    password VARCHAR(255),
    domain VARCHAR(50) DEFAULT 'WORKGROUP',
    workgroup VARCHAR(50) DEFAULT 'WORKGROUP',
    timeout INTEGER DEFAULT 30000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shared_path_id) REFERENCES shared_paths(id) ON DELETE CASCADE
);

-- NFS连接配置表
CREATE TABLE IF NOT EXISTS nfs_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shared_path_id INTEGER NOT NULL,
    server_ip VARCHAR(45) NOT NULL,
    export_path VARCHAR(500) NOT NULL,
    mount_point VARCHAR(500),
    mount_options TEXT DEFAULT 'ro,soft,intr',
    nfs_version VARCHAR(10) DEFAULT 'v3',
    timeout INTEGER DEFAULT 30000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shared_path_id) REFERENCES shared_paths(id) ON DELETE CASCADE
);

-- 访问日志表
CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shared_path_id INTEGER,
    client_ip VARCHAR(45) NOT NULL,
    user_agent TEXT,
    file_path VARCHAR(500),
    action VARCHAR(20) NOT NULL CHECK (action IN ('browse', 'download', 'thumbnail', 'access')),
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    response_time INTEGER,
    file_size INTEGER,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shared_path_id) REFERENCES shared_paths(id) ON DELETE SET NULL
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    type VARCHAR(20) DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 缩略图缓存表
CREATE TABLE IF NOT EXISTS thumbnail_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path VARCHAR(500) NOT NULL,
    shared_path_id INTEGER,
    cache_path VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64),
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (shared_path_id) REFERENCES shared_paths(id) ON DELETE CASCADE
);

-- 下载记录表
CREATE TABLE IF NOT EXISTS download_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shared_path_id INTEGER,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    client_ip VARCHAR(45) NOT NULL,
    user_agent TEXT,
    download_time INTEGER,
    completed BOOLEAN DEFAULT 0,
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shared_path_id) REFERENCES shared_paths(id) ON DELETE SET NULL
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR(128) UNIQUE NOT NULL,
    admin_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_shared_paths_type ON shared_paths(type);
CREATE INDEX IF NOT EXISTS idx_shared_paths_enabled ON shared_paths(enabled);
CREATE INDEX IF NOT EXISTS idx_access_logs_shared_path_id ON access_logs(shared_path_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_at ON access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_client_ip ON access_logs(client_ip);
CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_file_path ON thumbnail_cache(file_path);
CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_shared_path_id ON thumbnail_cache(shared_path_id);
CREATE INDEX IF NOT EXISTS idx_download_records_shared_path_id ON download_records(shared_path_id);
CREATE INDEX IF NOT EXISTS idx_download_records_downloaded_at ON download_records(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 创建视图用于统计
CREATE VIEW IF NOT EXISTS access_stats AS
SELECT 
    shared_path_id,
    COUNT(*) as total_accesses,
    COUNT(DISTINCT client_ip) as unique_visitors,
    COUNT(CASE WHEN action = 'download' THEN 1 END) as total_downloads,
    DATE(accessed_at) as access_date
FROM access_logs
GROUP BY shared_path_id, DATE(accessed_at);

CREATE VIEW IF NOT EXISTS download_stats AS
SELECT 
    shared_path_id,
    COUNT(*) as total_downloads,
    SUM(file_size) as total_size,
    AVG(download_time) as avg_download_time,
    DATE(downloaded_at) as download_date
FROM download_records
WHERE completed = 1
GROUP BY shared_path_id, DATE(downloaded_at); 