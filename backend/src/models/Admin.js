const bcrypt = require('bcrypt');
const dbManager = require('../config/database');
const { logDatabase, logSecurity } = require('../utils/logger');

class Admin {
    constructor(data = {}) {
        this.id = data.id || null;
        this.username = data.username || '';
        this.email = data.email || '';
        this.passwordHash = data.password_hash || '';
        this.createdAt = data.created_at || null;
        this.updatedAt = data.updated_at || null;
    }

    /**
     * 创建新管理员
     */
    static async create(adminData) {
        const startTime = Date.now();
        
        try {
            const { username, password, email } = adminData;
            
            // 检查用户名是否已存在
            const existingAdmin = await this.findByUsername(username);
            if (existingAdmin) {
                throw new Error('用户名已存在');
            }

            // 加密密码
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // 插入数据库
            const result = await dbManager.run(
                `INSERT INTO admins (username, password_hash, email) 
                 VALUES (?, ?, ?)`,
                [username, passwordHash, email || null]
            );

            const duration = Date.now() - startTime;
            logDatabase('INSERT', 'admins', duration, { username, email });

            // 返回新创建的管理员（不包含密码）
            return await this.findById(result.lastID);
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('INSERT_ERROR', 'admins', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 根据ID查找管理员
     */
    static async findById(id) {
        const startTime = Date.now();
        
        try {
            const admin = await dbManager.get(
                'SELECT id, username, email, created_at, updated_at FROM admins WHERE id = ?',
                [id]
            );

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'admins', duration, { id });

            return admin ? new Admin(admin) : null;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'admins', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 根据用户名查找管理员
     */
    static async findByUsername(username) {
        const startTime = Date.now();
        
        try {
            const admin = await dbManager.get(
                'SELECT id, username, email, created_at, updated_at FROM admins WHERE username = ?',
                [username]
            );

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'admins', duration, { username });

            return admin ? new Admin(admin) : null;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'admins', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 验证管理员登录
     */
    static async authenticate(username, password) {
        const startTime = Date.now();
        
        try {
            // 查找包含密码的管理员记录
            const admin = await dbManager.get(
                'SELECT id, username, password_hash, email, created_at, updated_at FROM admins WHERE username = ?',
                [username]
            );

            if (!admin) {
                logSecurity('LOGIN_ATTEMPT_INVALID_USER', { username });
                return null;
            }

            // 验证密码
            const isValid = await bcrypt.compare(password, admin.password_hash);
            
            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'admins', duration, { username, authenticated: isValid });

            if (isValid) {
                logSecurity('LOGIN_SUCCESS', { username, adminId: admin.id });
                // 返回管理员信息（不包含密码）
                const { password_hash, ...adminData } = admin;
                return new Admin(adminData);
            } else {
                logSecurity('LOGIN_ATTEMPT_INVALID_PASSWORD', { username, adminId: admin.id });
                return null;
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'admins', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 更新管理员信息
     */
    async update(updateData) {
        const startTime = Date.now();
        
        try {
            const allowedFields = ['username', 'email', 'password'];
            const updates = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    if (key === 'password') {
                        // 加密新密码
                        const saltRounds = 12;
                        const passwordHash = await bcrypt.hash(value, saltRounds);
                        updates.push('password_hash = ?');
                        values.push(passwordHash);
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
                `UPDATE admins SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );

            const duration = Date.now() - startTime;
            logDatabase('UPDATE', 'admins', duration, { id: this.id, fields: Object.keys(updateData) });

            if (result.changes === 0) {
                throw new Error('管理员不存在');
            }

            // 更新当前实例的数据
            const updatedAdmin = await Admin.findById(this.id);
            Object.assign(this, updatedAdmin);

            return this;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('UPDATE_ERROR', 'admins', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 删除管理员
     */
    async delete() {
        const startTime = Date.now();
        
        try {
            const result = await dbManager.run(
                'DELETE FROM admins WHERE id = ?',
                [this.id]
            );

            const duration = Date.now() - startTime;
            logDatabase('DELETE', 'admins', duration, { id: this.id });

            logSecurity('ADMIN_DELETED', { adminId: this.id, username: this.username });

            return result.changes > 0;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('DELETE_ERROR', 'admins', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 验证当前密码
     */
    async verifyPassword(password) {
        try {
            const admin = await dbManager.get(
                'SELECT password_hash FROM admins WHERE id = ?',
                [this.id]
            );

            if (!admin) {
                return false;
            }

            return await bcrypt.compare(password, admin.password_hash);
        } catch (error) {
            throw error;
        }
    }

    /**
     * 获取所有管理员列表
     */
    static async findAll(options = {}) {
        const startTime = Date.now();
        
        try {
            const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = options;
            const offset = (page - 1) * limit;

            // 验证排序字段
            const allowedSortFields = ['id', 'username', 'email', 'created_at', 'updated_at'];
            const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
            const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

            const admins = await dbManager.all(
                `SELECT id, username, email, created_at, updated_at 
                 FROM admins 
                 ORDER BY ${sortField} ${sortOrder} 
                 LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            // 获取总数
            const countResult = await dbManager.get('SELECT COUNT(*) as total FROM admins');
            const total = countResult.total;

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'admins', duration, { page, limit, total });

            return {
                admins: admins.map(admin => new Admin(admin)),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'admins', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 检查是否存在管理员
     */
    static async exists() {
        try {
            const result = await dbManager.get('SELECT COUNT(*) as count FROM admins');
            return result.count > 0;
        } catch (error) {
            throw error;
        }
    }

    /**
     * 获取管理员统计信息
     */
    static async getStats() {
        const startTime = Date.now();
        
        try {
            const stats = await dbManager.get(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email,
                    MIN(created_at) as first_created,
                    MAX(created_at) as last_created
                FROM admins
            `);

            const duration = Date.now() - startTime;
            logDatabase('SELECT', 'admins', duration, { operation: 'stats' });

            return stats;
        } catch (error) {
            const duration = Date.now() - startTime;
            logDatabase('SELECT_ERROR', 'admins', duration, { error: error.message });
            throw error;
        }
    }

    /**
     * 转换为JSON对象（排除敏感信息）
     */
    toJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * 转换为安全的JSON对象（用于API响应）
     */
    toSafeJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email
        };
    }

    // 静态方法补充
    static async usernameExists(username, excludeId = null) {
        try {
            let query = 'SELECT COUNT(*) as count FROM admins WHERE username = ?';
            let params = [username];
            
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

    static async emailExists(email, excludeId = null) {
        try {
            let query = 'SELECT COUNT(*) as count FROM admins WHERE email = ?';
            let params = [email];
            
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

    static async update(id, updateData) {
        try {
            const admin = await this.findById(id);
            if (!admin) {
                throw new Error('管理员不存在');
            }
            
            return await admin.update(updateData);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Admin; 