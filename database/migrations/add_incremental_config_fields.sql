-- 为shared_paths表添加增量更新配置字段
-- 执行时间: 2025-06-23

ALTER TABLE shared_paths ADD COLUMN incremental_update_enabled BOOLEAN DEFAULT 1;
ALTER TABLE shared_paths ADD COLUMN incremental_check_interval INTEGER DEFAULT 600000; -- 默认10分钟，单位毫秒
ALTER TABLE shared_paths ADD COLUMN full_rebuild_threshold REAL DEFAULT 0.8; -- 默认80%
ALTER TABLE shared_paths ADD COLUMN incremental_config_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 更新现有记录的默认值
UPDATE shared_paths 
SET incremental_update_enabled = 1,
    incremental_check_interval = 600000,
    full_rebuild_threshold = 0.8,
    incremental_config_updated_at = CURRENT_TIMESTAMP
WHERE incremental_update_enabled IS NULL; 