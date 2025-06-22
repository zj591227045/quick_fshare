const bcrypt = require('bcrypt');
const dbManager = require('../config/database');
const { logDatabase, logSecurity } = require('../utils/logger');

class Share {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.description = data.description || '';
        this.path = data.path || '';
        this.type = data.type || 'local';
        this.accessType = data.access_type || 'public';
        this.password = data.password || null;
        this.enabled = data.enabled !== undefined ? Boolean(data.enabled) : true;
        this.sortOrder = data.sort_order || 0;
        this.createdAt = data.created_at || null;
        this.updatedAt = data.updated_at || null;
        
        // 关联配置
        this.smbConfig = data.smbConfig || null;
        this.nfsConfig = data.nfsConfig || null;
    }

    /**
     * 创建新的分享路径
     */
    static async create(shareData) {
        const startTime = Date.now();
        
        try {
            const {
                name,
                description = '',
                path,
                type,
                access_type = 'public',
                password,
                enabled = true,
                sort_order = 0,
                smbConfig,
                nfsConfig
            } = shareData;

            // 检查名称是否已存在
            const existingShare = await this.findByName(name);
            if (existingShare) {
                throw new Error('分享名称已存在');
            }

            // 加密密码（如果有）
            let hashedPassword = null;
            if (access_type === 'password' && password) {
                const saltRounds = 10;
                hashedPassword = await bcrypt.hash(password, saltRounds);
            }

            // 开始事务
            const result = await dbManager.transaction(async () => {
                // 插入分享路径
                const shareResult = await dbManager.run(
                    `INSERT INTO shared_paths (name, description, path, type, access_type, password, enabled, sort_order) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [name, description, path, type, access_type, hashedPassword, enabled ? 1 : 0, sort_order]
                );

                const shareId = shareResult.lastID;

                // 插入SMB配置
                if (type === 'smb' && smbConfig) {
                    await dbManager.run(
                        `INSERT INTO smb_configs (shared_path_id, server_ip, port, share_name, username, password, domain, workgroup, timeout)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            shareId,
                            smbConfig.server_ip,
                            smbConfig.port || 445,
                            smbConfig.share_name,
                            smbConfig.username || '',
                            smbConfig.password || '',
                            smbConfig.domain || 'WORKGROUP',
                            smbConfig.workgroup || 'WORKGROUP',
                            smbConfig.timeout || 30000
                        ]
                    );
                }

                // 插入NFS配置
                if (type === 'nfs' && nfsConfig) {
                    await dbManager.run(
                        `INSERT INTO nfs_configs (shared_path_id, server_ip, export_path, mount_point, mount_options, nfs_version, timeout)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            shareId,
                            nfsConfig.server_ip,
                            nfsConfig.export_path,
                            nfsConfig.mount_point || '',
                            nfsConfig.mount_options || 'ro,soft,intr',
                            nfsConfig.nfs_version || 'v3',
                            nfsConfig.timeout || 30000
                        ]
                    );
                }

                return shareId;
            });

            const duration = Date.now() - startTime;
            logDatabase('INSERT', 'shared_paths', duration, { name, type, access_type });

            // 返回新创建的分享路径
            return await this.findById(result);
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('INSERT_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 根据ID查找分享路径
     */
    static async findById(id, includePassword = false) {
        const startTime = Date.now();
        
        try {
            const passwordField = includePassword ? ', password' : '';
            
            // 查询分享路径基本信息
            const share = await dbManager.get(
                `SELECT id, name, description, path, type, access_type${passwordField}, enabled, sort_order, created_at, updated_at
                 FROM shared_paths WHERE id = ?`,
                [id]
            );

            if (!share) {
                return null;
            }

            // 查询SMB配置
            let smbConfig = null;
            if (share.type === 'smb') {
                smbConfig = await dbManager.get(
                    'SELECT * FROM smb_configs WHERE shared_path_id = ?',
                    [id]
                );
            }

            // 查询NFS配置
            let nfsConfig = null;
            if (share.type === 'nfs') {
                nfsConfig = await dbManager.get(
                    'SELECT * FROM nfs_configs WHERE shared_path_id = ?',
                    [id]
                );
            }

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'shared_paths', duration, { id });

            // 创建Share实例
            const shareInstance = new Share(share);
            shareInstance.smbConfig = smbConfig;
            shareInstance.nfsConfig = nfsConfig;

            return shareInstance;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 根据名称查找分享路径
     */
    static async findByName(name) {
        const startTime = Date.now();
        
        try {
            const share = await dbManager.get(
                'SELECT id, name, description, path, type, access_type, enabled, sort_order, created_at, updated_at FROM shared_paths WHERE name = ? COLLATE NOCASE',
                [name]
            );

            if (!share) {
                return null;
            }

            // 查询SMB配置
            let smbConfig = null;
            if (share.type === 'smb') {
                smbConfig = await dbManager.get(
                    'SELECT * FROM smb_configs WHERE shared_path_id = ?',
                    [share.id]
                );
            }

            // 查询NFS配置
            let nfsConfig = null;
            if (share.type === 'nfs') {
                nfsConfig = await dbManager.get(
                    'SELECT * FROM nfs_configs WHERE shared_path_id = ?',
                    [share.id]
                );
            }

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'shared_paths', duration, { name });

            // 创建Share实例
            const shareInstance = new Share(share);
            shareInstance.smbConfig = smbConfig;
            shareInstance.nfsConfig = nfsConfig;

            return shareInstance;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 获取所有分享路径
     */
    static async findAll(options = {}) {
        const startTime = Date.now();
        
        try {
            const {
                page = 1,
                limit = 20,
                sort = 'sort_order',
                order = 'asc',
                type,
                enabled,
                search
            } = options;

            const offset = (page - 1) * limit;
            const conditions = [];
            const params = [];

            // 构建查询条件
            if (type) {
                conditions.push('type = ?');
                params.push(type);
            }

            if (enabled !== undefined) {
                conditions.push('enabled = ?');
                params.push(enabled ? 1 : 0);
            }

            if (search) {
                conditions.push('(name LIKE ? OR description LIKE ? OR path LIKE ?)');
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // 验证排序字段
            const allowedSortFields = ['id', 'name', 'type', 'access_type', 'enabled', 'sort_order', 'created_at', 'updated_at'];
            const sortField = allowedSortFields.includes(sort) ? sort : 'sort_order';
            const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

            // 查询分享路径
            const shares = await dbManager.all(
                `SELECT id, name, description, path, type, access_type, enabled, sort_order, created_at, updated_at
                 FROM shared_paths 
                 ${whereClause}
                 ORDER BY ${sortField} ${sortOrder}
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            // 获取总数
            const countResult = await dbManager.get(
                `SELECT COUNT(*) as total FROM shared_paths ${whereClause}`,
                params
            );

            // 为每个分享路径加载配置信息
            const sharesWithConfig = await Promise.all(shares.map(async (shareData) => {
                const share = new Share(shareData);
                
                // 查询SMB配置
                if (share.type === 'smb') {
                    share.smbConfig = await dbManager.get(
                        'SELECT * FROM smb_configs WHERE shared_path_id = ?',
                        [share.id]
                    );
                }

                // 查询NFS配置
                if (share.type === 'nfs') {
                    share.nfsConfig = await dbManager.get(
                        'SELECT * FROM nfs_configs WHERE shared_path_id = ?',
                        [share.id]
                    );
                }

                return share;
            }));

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'shared_paths', duration, { page, limit, total: countResult.total });

            return {
                shares: sharesWithConfig,
                pagination: {
                    page,
                    limit,
                    total: countResult.total,
                    pages: Math.ceil(countResult.total / limit),
                    hasNext: page < Math.ceil(countResult.total / limit),
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 获取启用的公开分享路径
     */
    static async findPublicShares() {
        const startTime = Date.now();
        
        try {
            const shares = await dbManager.all(
                `SELECT id, name, description, path, type, access_type, enabled, sort_order, created_at
                 FROM shared_paths 
                 WHERE enabled = 1 
                 ORDER BY sort_order ASC, name ASC`
            );

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'shared_paths', duration, { filter: 'public_enabled' });

            return shares.map(share => new Share(share));
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 更新分享路径
     */
    async update(updateData) {
        const startTime = Date.now();
        
        try {
            const allowedFields = ['name', 'description', 'path', 'type', 'access_type', 'password', 'enabled', 'sort_order'];
            const updates = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    if (key === 'password') {
                        if (value && value.trim() !== '') {
                            // 只有在提供了新密码时才更新
                            const saltRounds = 10;
                            const hashedPassword = await bcrypt.hash(value, saltRounds);
                            updates.push('password = ?');
                            values.push(hashedPassword);
                        }
                        // 如果密码为空，则跳过不更新
                    } else if (key === 'enabled') {
                        updates.push('enabled = ?');
                        values.push(value ? 1 : 0);
                    } else {
                        updates.push(`${key} = ?`);
                        values.push(value);
                    }
                }
            }

            if (updates.length === 0) {
                throw new Error('没有有效的更新字段');
            }

            values.push(this.id);

            const result = await dbManager.run(
                `UPDATE shared_paths SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );

            const duration = Date.now() - startTime;
            logDatabase('UPDATE', 'shared_paths', duration, { id: this.id, fields: Object.keys(updateData) });

            if (result.changes === 0) {
                throw new Error('分享路径不存在');
            }

            // 更新当前实例的数据
            const updatedShare = await Share.findById(this.id);
            Object.assign(this, updatedShare);

            return this;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('UPDATE_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 删除分享路径
     */
    async delete() {
        const startTime = Date.now();
        
        try {
            const result = await dbManager.transaction(async () => {
                // 删除相关配置
                await dbManager.run('DELETE FROM smb_configs WHERE shared_path_id = ?', [this.id]);
                await dbManager.run('DELETE FROM nfs_configs WHERE shared_path_id = ?', [this.id]);
                
                // 删除分享路径
                const deleteResult = await dbManager.run('DELETE FROM shared_paths WHERE id = ?', [this.id]);
                
                return deleteResult.changes > 0;
            });

            const duration = Date.now() - startTime;
            logDatabase('DELETE', 'shared_paths', duration, { id: this.id });

            logSecurity('SHARE_DELETED', { shareId: this.id, shareName: this.name });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('DELETE_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 验证分享密码
     */
    async verifyPassword(password) {
        try {
            if (this.accessType !== 'password') {
                return true; // 公开分享无需密码
            }

            // 如果实例已经包含密码，直接使用
            if (this.password) {
                const isValid = await bcrypt.compare(password, this.password);
                
                if (isValid) {
                    logSecurity('SHARE_PASSWORD_SUCCESS', { shareId: this.id, shareName: this.name });
                } else {
                    logSecurity('SHARE_PASSWORD_FAILED', { shareId: this.id, shareName: this.name });
                }
                
                return isValid;
            }

            // 如果实例不包含密码，则查询数据库（向后兼容）
            const share = await dbManager.get(
                'SELECT password FROM shared_paths WHERE id = ?',
                [this.id]
            );

            if (!share || !share.password) {
                return false;
            }

            const isValid = await bcrypt.compare(password, share.password);
            
            if (isValid) {
                logSecurity('SHARE_PASSWORD_SUCCESS', { shareId: this.id, shareName: this.name });
            } else {
                logSecurity('SHARE_PASSWORD_FAILED', { shareId: this.id, shareName: this.name });
            }

            return isValid;
        } catch (error) {
            throw error;
        }
    }

    /**
     * 切换启用状态
     */
    async toggleEnabled() {
        const startTime = Date.now();
        
        try {
            const newStatus = !this.enabled;
            
            const result = await dbManager.run(
                'UPDATE shared_paths SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newStatus ? 1 : 0, this.id]
            );

            const duration = Date.now() - startTime;
            logDatabase('UPDATE', 'shared_paths', duration, { id: this.id, field: 'enabled', value: newStatus });

            if (result.changes > 0) {
                this.enabled = newStatus;
                logSecurity('SHARE_STATUS_CHANGED', { 
                    shareId: this.id, 
                    shareName: this.name, 
                    enabled: newStatus 
                });
            }

            return result.changes > 0;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('UPDATE_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 获取分享统计信息
     */
    async getStats() {
        const startTime = Date.now();
        
        try {
            // 获取访问统计
            const accessStats = await dbManager.get(`
                SELECT 
                    COUNT(*) as total_accesses,
                    COUNT(DISTINCT client_ip) as unique_visitors,
                    COUNT(CASE WHEN action = 'download' THEN 1 END) as downloads,
                    COUNT(CASE WHEN success = 1 THEN 1 END) as successful_accesses,
                    MAX(accessed_at) as last_access
                FROM access_logs 
                WHERE shared_path_id = ?
            `, [this.id]);

            // 获取下载统计
            const downloadStats = await dbManager.get(`
                SELECT 
                    COUNT(*) as total_downloads,
                    SUM(file_size) as total_size,
                    AVG(download_time) as avg_download_time,
                    COUNT(CASE WHEN completed = 1 THEN 1 END) as completed_downloads
                FROM download_records 
                WHERE shared_path_id = ?
            `, [this.id]);

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'access_logs,download_records', duration, { shareId: this.id });

            return {
                access: accessStats,
                download: downloadStats
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'access_logs,download_records', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 获取分享类型统计
     */
    static async getTypeStats() {
        const startTime = Date.now();
        
        try {
            const stats = await dbManager.all(`
                SELECT 
                    type,
                    COUNT(*) as count,
                    COUNT(CASE WHEN enabled = 1 THEN 1 END) as enabled_count,
                    COUNT(CASE WHEN access_type = 'password' THEN 1 END) as password_protected_count
                FROM shared_paths 
                GROUP BY type
            `);

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'shared_paths', duration, { operation: 'type_stats' });

            return stats;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 转换为JSON对象（排除敏感信息）
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            path: this.path,
            type: this.type,
            accessType: this.accessType,
            hasPassword: this.accessType === 'password' && !!this.password,
            enabled: this.enabled,
            sortOrder: this.sortOrder,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            smbConfig: this.smbConfig,
            nfsConfig: this.nfsConfig
        };
    }

    /**
     * 转换为公开JSON对象（用于公开API）
     */
    toPublicJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            type: this.type,
            accessType: this.accessType,
            hasPassword: this.accessType === 'password'
        };
    }

    // 静态方法补充
    static async nameExists(name, excludeId = null) {
        try {
            let query = 'SELECT COUNT(*) as count FROM shared_paths WHERE name = ?';
            let params = [name];
            
            if (excludeId) {
                query += ' AND id != ?';
                params.push(excludeId);
            }
            
            const result = await dbManager.get(query, params);
            return result.count > 0;
        } catch (error) {
            throw error;
        }
    }

    static async findEnabled() {
        try {
            const shares = await dbManager.all(
                'SELECT * FROM shared_paths WHERE enabled = 1 ORDER BY sort_order ASC, name ASC'
            );
            return shares.map(share => new Share(share));
        } catch (error) {
            throw error;
        }
    }

    static async validatePassword(shareId, password) {
        try {
            const share = await this.findById(shareId, true);
            if (!share) {
                return { valid: false, error: '分享不存在' };
            }
            
            if (share.accessType !== 'password') {
                return { valid: true };
            }
            
            if (!password) {
                return { valid: false, error: '请输入密码' };
            }
            
            const isValid = await bcrypt.compare(password, share.password);
            return { valid: isValid, error: isValid ? null : '密码错误' };
        } catch (error) {
            return { valid: false, error: '验证失败' };
        }
    }

    static async getStats() {
        try {
            const totalShares = await dbManager.get('SELECT COUNT(*) as count FROM shared_paths');
            const enabledShares = await dbManager.get('SELECT COUNT(*) as count FROM shared_paths WHERE enabled = 1');
            const typeStats = await this.getTypeStats();
            
            return {
                total: totalShares.count,
                enabled: enabledShares.count,
                disabled: totalShares.count - enabledShares.count,
                byType: typeStats
            };
        } catch (error) {
            throw error;
        }
    }

    static async update(id, updateData) {
        const startTime = Date.now();
        
        try {
            const {
                name,
                description,
                path,
                type,
                access_type,
                password,
                enabled,
                sort_order
            } = updateData;

            let hashedPassword = undefined;
            if (access_type === 'password' && password && password.trim() !== '') {
                const saltRounds = 10;
                hashedPassword = await bcrypt.hash(password, saltRounds);
            }

            const updates = [];
            const params = [];
            
            if (name !== undefined) { updates.push('name = ?'); params.push(name); }
            if (description !== undefined) { updates.push('description = ?'); params.push(description); }
            if (path !== undefined) { updates.push('path = ?'); params.push(path); }
            if (type !== undefined) { updates.push('type = ?'); params.push(type); }
            if (access_type !== undefined) { updates.push('access_type = ?'); params.push(access_type); }
            if (hashedPassword !== undefined) { updates.push('password = ?'); params.push(hashedPassword); }
            if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
            if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
            
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            const query = `UPDATE shared_paths SET ${updates.join(', ')} WHERE id = ?`;
            const result = await dbManager.run(query, params);

            const duration = Date.now() - startTime;
            logDatabase('UPDATE', 'shared_paths', duration, { id });

            return result.changes > 0;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('UPDATE_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }

    static async delete(id) {
        const startTime = Date.now();
        
        try {
            const result = await dbManager.transaction(async () => {
                // 删除相关配置
                await dbManager.run('DELETE FROM smb_configs WHERE shared_path_id = ?', [id]);
                await dbManager.run('DELETE FROM nfs_configs WHERE shared_path_id = ?', [id]);
                
                // 删除分享路径
                const deleteResult = await dbManager.run('DELETE FROM shared_paths WHERE id = ?', [id]);
                
                return deleteResult.changes > 0;
            });

            const duration = Date.now() - startTime;
            logDatabase('DELETE', 'shared_paths', duration, { id });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('DELETE_ERROR', 'shared_paths', duration, { error: error.message });
            throw error;
        }
    }
}

module.exports = Share; 