-- Quick FShare 默认种子数据
-- 插入默认数据和配置

-- 插入默认管理员 (用户名: admin, 密码: admin123)
-- 密码使用bcrypt哈希，实际应用中应该通过程序生成
INSERT OR IGNORE INTO admins (id, username, password_hash, email) VALUES 
(1, 'admin', '$2b$10$K5jJyQjQYoY2QqQ4QjQqQeK5jJyQjQYoY2QqQ4QjQqQeK5jJyQjQYo', 'admin@quickfshare.local');

-- 插入默认系统设置
INSERT OR IGNORE INTO system_settings (key, value, type, description) VALUES 
('theme', 'light', 'string', '默认主题设置'),
('language', 'zh-CN', 'string', '系统语言'),
('site_title', 'Quick FShare', 'string', '网站标题'),
('site_description', '局域网文件快速分享系统', 'string', '网站描述'),
('max_file_size', '104857600', 'number', '最大文件大小限制(字节)'),
('thumbnail_enabled', 'true', 'boolean', '是否启用缩略图'),
('thumbnail_quality', '80', 'number', '缩略图质量(1-100)'),
('thumbnail_max_size', '200', 'number', '缩略图最大尺寸(像素)'),
('log_level', 'info', 'string', '日志级别'),
('log_retention_days', '30', 'number', '日志保留天数'),
('session_timeout', '3600', 'number', '会话超时时间(秒)'),
('rate_limit_enabled', 'true', 'boolean', '是否启用请求频率限制'),
('rate_limit_window', '900000', 'number', '频率限制时间窗口(毫秒)'),
('rate_limit_max', '100', 'number', '频率限制最大请求数'),
('cors_enabled', 'true', 'boolean', '是否启用CORS'),
('cors_origins', '*', 'string', 'CORS允许的源'),
('security_headers', 'true', 'boolean', '是否启用安全头'),
('https_only', 'false', 'boolean', '是否仅允许HTTPS'),
('auto_cleanup_enabled', 'true', 'boolean', '是否自动清理过期数据'),
('cleanup_interval', '86400', 'number', '清理任务间隔(秒)'),
('backup_enabled', 'false', 'boolean', '是否启用自动备份'),
('backup_interval', '604800', 'number', '备份间隔(秒)'),
('monitoring_enabled', 'true', 'boolean', '是否启用监控'),
('stats_retention_days', '90', 'number', '统计数据保留天数');

-- 插入示例分享路径 (仅开发环境使用)
INSERT OR IGNORE INTO shared_paths (id, name, description, path, type, access_type, enabled) VALUES 
(1, '文档文件夹', '示例文档分享', '/Users/Shared/Documents', 'local', 'public', 1),
(2, '图片文件夹', '示例图片分享', '/Users/Shared/Pictures', 'local', 'public', 1);

-- 更新时间戳触发器(SQLite 3.25+)
-- 为主要表添加自动更新时间戳
CREATE TRIGGER IF NOT EXISTS update_admins_timestamp 
    AFTER UPDATE ON admins
    BEGIN
        UPDATE admins SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_shared_paths_timestamp 
    AFTER UPDATE ON shared_paths
    BEGIN
        UPDATE shared_paths SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_smb_configs_timestamp 
    AFTER UPDATE ON smb_configs
    BEGIN
        UPDATE smb_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_nfs_configs_timestamp 
    AFTER UPDATE ON nfs_configs
    BEGIN
        UPDATE nfs_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_system_settings_timestamp 
    AFTER UPDATE ON system_settings
    BEGIN
        UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END; 