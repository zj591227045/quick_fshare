-- 为共享名称添加唯一性约束的迁移脚本
-- 运行前请备份数据库

-- 1. 首先检查是否有重复的名称
SELECT name, COUNT(*) as count 
FROM shared_paths 
GROUP BY name 
HAVING COUNT(*) > 1;

-- 2. 如果有重复名称，需要手动处理或运行以下脚本重命名
-- UPDATE shared_paths 
-- SET name = name || '_' || id 
-- WHERE id IN (
--     SELECT id FROM (
--         SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) as rn
--         FROM shared_paths
--     ) WHERE rn > 1
-- );

-- 3. 创建新的表结构（包含唯一约束）
CREATE TABLE shared_paths_new (
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

-- 4. 复制数据到新表
INSERT INTO shared_paths_new (id, name, description, path, type, access_type, password, enabled, sort_order, created_at, updated_at)
SELECT id, name, description, path, type, access_type, password, enabled, sort_order, created_at, updated_at
FROM shared_paths;

-- 5. 删除旧表并重命名新表
DROP TABLE shared_paths;
ALTER TABLE shared_paths_new RENAME TO shared_paths;

-- 6. 重新创建索引
CREATE INDEX IF NOT EXISTS idx_shared_paths_type ON shared_paths(type);
CREATE INDEX IF NOT EXISTS idx_shared_paths_enabled ON shared_paths(enabled);

-- 完成迁移
SELECT 'Migration completed successfully. Share names now have UNIQUE constraint.' as result; 