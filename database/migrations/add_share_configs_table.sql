-- 创建分享配置表
CREATE TABLE IF NOT EXISTS share_configs (
  share_id INTEGER PRIMARY KEY,
  incremental_update_enabled BOOLEAN DEFAULT 1,
  incremental_check_interval INTEGER DEFAULT 3600000,
  full_rebuild_threshold REAL DEFAULT 0.9,
  smart_indexing_enabled BOOLEAN DEFAULT 1,
  file_system_watch_enabled BOOLEAN DEFAULT 1,
  index_priority INTEGER DEFAULT 0,
  sample_scan_enabled BOOLEAN DEFAULT 1,
  sample_scan_ratio REAL DEFAULT 0.1,
  skip_hidden_files BOOLEAN DEFAULT 1,
  max_directory_depth INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (share_id) REFERENCES shared_paths(id) ON DELETE CASCADE
);

-- 为已有的分享添加默认配置
INSERT OR IGNORE INTO share_configs (share_id)
SELECT id FROM shared_paths; 