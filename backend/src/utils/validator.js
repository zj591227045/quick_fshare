const Joi = require('joi');
const path = require('path');

// 通用验证模式
const commonSchemas = {
    id: Joi.number().integer().positive(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    orderBy: Joi.string().alphanum().default('created_at'),
    search: Joi.string().min(1).max(100).trim(),
    password: Joi.string().min(6).max(50).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .message('密码必须包含至少一个小写字母、一个大写字母和一个数字'),
    email: Joi.string().email().max(100),
    ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }),
    url: Joi.string().uri(),
    timestamp: Joi.date().iso()
};

// 管理员验证模式
const adminSchemas = {
    // 创建管理员
    create: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required()
            .messages({
                'string.alphanum': '用户名只能包含字母和数字',
                'string.min': '用户名至少需要3个字符',
                'string.max': '用户名不能超过30个字符',
                'any.required': '用户名是必填项'
            }),
        password: commonSchemas.password.required(),
        email: commonSchemas.email
    }),

    // 更新管理员
    update: Joi.object({
        username: Joi.string().alphanum().min(3).max(30),
        email: commonSchemas.email,
        currentPassword: Joi.string().when('password', {
            is: Joi.exist(),
            then: Joi.required(),
            otherwise: Joi.forbidden()
        }),
        password: commonSchemas.password
    }),

    // 登录验证
    login: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
        rememberMe: Joi.boolean().default(false)
    }),

    // ID验证
    id: Joi.object({
        id: commonSchemas.id.required()
    })
};

// 分享路径验证模式
const shareSchemas = {
    // 创建分享路径
    create: Joi.object({
        name: Joi.string().min(1).max(100).required()
            .messages({
                'string.min': '分享名称不能为空',
                'string.max': '分享名称不能超过100个字符',
                'any.required': '分享名称是必填项'
            }),
        description: Joi.string().max(500).allow(''),
        path: Joi.string().min(1).max(500).required()
            .custom((value, helpers) => {
                // 验证路径格式
                if (!path.isAbsolute(value) && !value.startsWith('/')) {
                    return helpers.error('path.invalid');
                }
                // 防止路径遍历攻击
                if (value.includes('..') || value.includes('~')) {
                    return helpers.error('path.unsafe');
                }
                return value;
            })
            .messages({
                'path.invalid': '路径必须是绝对路径',
                'path.unsafe': '路径包含不安全字符',
                'any.required': '路径是必填项'
            }),
        type: Joi.string().valid('local', 'smb', 'nfs').required(),
        access_type: Joi.string().valid('public', 'password').default('public'),
        password: Joi.when('access_type', {
            is: 'password',
            then: Joi.string().min(1).max(50).required(),
            otherwise: Joi.string().allow(null, '')
        }),
        enabled: Joi.boolean().default(true),
        sort_order: Joi.number().integer().min(0).default(0)
    }),

    // 更新分享路径
    update: Joi.object({
        name: Joi.string().min(1).max(100),
        description: Joi.string().max(500).allow(''),
        path: Joi.string().min(1).max(500)
            .custom((value, helpers) => {
                if (!path.isAbsolute(value) && !value.startsWith('/')) {
                    return helpers.error('path.invalid');
                }
                if (value.includes('..') || value.includes('~')) {
                    return helpers.error('path.unsafe');
                }
                return value;
            }),
        type: Joi.string().valid('local', 'smb', 'nfs'),
        access_type: Joi.string().valid('public', 'password'),
        password: Joi.when('access_type', {
            is: 'password',
            then: Joi.string().min(1).max(50),
            otherwise: Joi.string().allow(null, '')
        }),
        enabled: Joi.boolean(),
        sort_order: Joi.number().integer().min(0)
    }),

    // 密码验证
    verifyPassword: Joi.object({
        shareId: commonSchemas.id.required(),
        password: Joi.string().required()
    }),

    // ID验证
    id: Joi.object({
        id: commonSchemas.id.required()
    })
};

// SMB配置验证模式
const smbSchemas = {
    create: Joi.object({
        shared_path_id: commonSchemas.id.required(),
        server_ip: commonSchemas.ip.required(),
        port: Joi.number().integer().min(1).max(65535).default(445),
        share_name: Joi.string().min(1).max(100).required(),
        username: Joi.string().max(50).allow(''),
        password: Joi.string().max(255).allow(''),
        domain: Joi.string().max(50).default('WORKGROUP'),
        workgroup: Joi.string().max(50).default('WORKGROUP'),
        timeout: Joi.number().integer().min(1000).max(300000).default(30000)
    }),

    update: Joi.object({
        server_ip: commonSchemas.ip,
        port: Joi.number().integer().min(1).max(65535),
        share_name: Joi.string().min(1).max(100),
        username: Joi.string().max(50).allow(''),
        password: Joi.string().max(255).allow(''),
        domain: Joi.string().max(50),
        workgroup: Joi.string().max(50),
        timeout: Joi.number().integer().min(1000).max(300000)
    })
};

// NFS配置验证模式
const nfsSchemas = {
    create: Joi.object({
        shared_path_id: commonSchemas.id.required(),
        server_ip: commonSchemas.ip.required(),
        export_path: Joi.string().min(1).max(500).required(),
        mount_point: Joi.string().max(500).allow(''),
        mount_options: Joi.string().max(200).default('ro,soft,intr'),
        nfs_version: Joi.string().valid('v2', 'v3', 'v4', 'v4.1', 'v4.2').default('v3'),
        timeout: Joi.number().integer().min(1000).max(300000).default(30000)
    }),

    update: Joi.object({
        server_ip: commonSchemas.ip,
        export_path: Joi.string().min(1).max(500),
        mount_point: Joi.string().max(500).allow(''),
        mount_options: Joi.string().max(200),
        nfs_version: Joi.string().valid('v2', 'v3', 'v4', 'v4.1', 'v4.2'),
        timeout: Joi.number().integer().min(1000).max(300000)
    })
};

// 文件操作验证模式
const fileSchemas = {
    browse: Joi.object({
        shareId: commonSchemas.id.required(),
        path: Joi.string().allow('').default('')
            .custom((value, helpers) => {
                // 防止路径遍历攻击
                if (value.includes('..') || value.includes('~')) {
                    return helpers.error('path.unsafe');
                }
                return value;
            })
            .messages({
                'path.unsafe': '路径包含不安全字符'
            }),
        page: commonSchemas.page,
        limit: commonSchemas.limit,
        sort: Joi.string().valid('name', 'size', 'modified', 'type').default('name'),
        order: commonSchemas.sort,
        search: commonSchemas.search,
        type: Joi.string().valid('all', 'file', 'directory').default('all')
    }),

    download: Joi.object({
        shareId: commonSchemas.id.required(),
        path: Joi.string().required()
            .custom((value, helpers) => {
                if (value.includes('..') || value.includes('~')) {
                    return helpers.error('path.unsafe');
                }
                return value;
            })
    }),

    thumbnail: Joi.object({
        shareId: commonSchemas.id.required(),
        path: Joi.string().required(),
        size: Joi.number().integer().min(50).max(500).default(200)
    })
};

// 系统设置验证模式
const systemSchemas = {
    updateSettings: Joi.object({
        theme: Joi.string().valid('light', 'dark', 'auto'),
        language: Joi.string().valid('zh-CN', 'en-US'),
        site_title: Joi.string().min(1).max(100),
        site_description: Joi.string().max(500),
        max_file_size: Joi.number().integer().min(1024).max(1073741824), // 1KB - 1GB
        thumbnail_enabled: Joi.boolean(),
        thumbnail_quality: Joi.number().integer().min(1).max(100),
        thumbnail_max_size: Joi.number().integer().min(50).max(1000),
        log_level: Joi.string().valid('error', 'warn', 'info', 'debug'),
        log_retention_days: Joi.number().integer().min(1).max(365),
        session_timeout: Joi.number().integer().min(300).max(86400), // 5分钟 - 1天
        rate_limit_enabled: Joi.boolean(),
        rate_limit_window: Joi.number().integer().min(60000).max(3600000), // 1分钟 - 1小时
        rate_limit_max: Joi.number().integer().min(1).max(10000)
    }),

    logs: Joi.object({
        level: Joi.string().valid('all', 'error', 'warn', 'info', 'debug').default('all'),
        startDate: commonSchemas.timestamp,
        endDate: commonSchemas.timestamp,
        search: commonSchemas.search,
        page: commonSchemas.page,
        limit: commonSchemas.limit
    })
};

/**
 * 创建验证中间件
 */
function createValidator(schema, source = 'body') {
    return (req, res, next) => {
        const data = source === 'params' ? req.params :
                    source === 'query' ? req.query :
                    source === 'headers' ? req.headers :
                    req.body;

        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const errorMessage = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                errors: errorMessage
            });
        }

        // 将验证后的数据写回请求对象
        if (source === 'params') req.params = value;
        else if (source === 'query') req.query = value;
        else if (source === 'headers') req.headers = value;
        else req.body = value;

        next();
    };
}

/**
 * 验证文件路径安全性
 */
function validateFilePath(filePath) {
    // 检查路径遍历攻击
    if (filePath.includes('..') || filePath.includes('~')) {
        return { valid: false, error: '路径包含不安全字符' };
    }

    // 检查隐藏文件（可选）
    const basename = path.basename(filePath);
    if (basename.startsWith('.') && basename !== '.' && basename !== '..') {
        return { valid: false, error: '不允许访问隐藏文件' };
    }

    // 检查文件名长度
    if (basename.length > 255) {
        return { valid: false, error: '文件名过长' };
    }

    return { valid: true };
}

/**
 * 验证密码强度
 */
function validatePasswordStrength(password) {
    const checks = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;
    
    let strength = 'very_weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 3) strength = 'medium';
    else if (score >= 2) strength = 'weak';

    return {
        strength,
        score,
        checks,
        suggestions: {
            length: !checks.length ? '密码至少需要8个字符' : null,
            lowercase: !checks.lowercase ? '添加小写字母' : null,
            uppercase: !checks.uppercase ? '添加大写字母' : null,
            number: !checks.number ? '添加数字' : null,
            special: !checks.special ? '添加特殊字符' : null
        }
    };
}

/**
 * 验证IP地址格式
 */
function validateIPAddress(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * 通用数据清理函数
 */
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return input.trim()
            .replace(/[<>]/g, '') // 移除尖括号
            .replace(/javascript:/gi, '') // 移除javascript:
            .replace(/on\w+=/gi, ''); // 移除事件处理器
    }
    
    if (Array.isArray(input)) {
        return input.map(sanitizeInput);
    }
    
    if (input && typeof input === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    
    return input;
}

// 导出验证模式和函数
module.exports = {
    // 验证模式
    schemas: {
        admin: adminSchemas,
        share: shareSchemas,
        smb: smbSchemas,
        nfs: nfsSchemas,
        file: fileSchemas,
        system: systemSchemas,
        common: commonSchemas
    },

    // 验证中间件
    validate: {
        body: (schema) => createValidator(schema, 'body'),
        params: (schema) => createValidator(schema, 'params'),
        query: (schema) => createValidator(schema, 'query'),
        headers: (schema) => createValidator(schema, 'headers')
    },

    // 工具函数
    validateFilePath,
    validatePasswordStrength,
    validateIPAddress,
    sanitizeInput,
    createValidator
}; 