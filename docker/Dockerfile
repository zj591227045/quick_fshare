# Quick FShare 单一容器部署 - 多阶段构建优化
# 将前端、后端、数据库打包为单一容器

# ======== 阶段1: 前端构建 ========
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ======== 阶段2: 后端依赖安装 ========
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --only=production && npm cache clean --force

# ======== 阶段3: 最终运行镜像 ========
FROM node:18-alpine

# 安装必要的系统工具
RUN apk add --no-cache \
    nginx \
    sqlite \
    curl \
    supervisor \
    dumb-init && \
    rm -rf /var/cache/apk/*

# 设置工作目录
WORKDIR /app

# ======== 复制后端代码和依赖 ========
COPY backend/ ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# ======== 复制前端构建结果 ========
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# ======== 复制数据库相关文件 ========
COPY database/ ./database/

# ======== 配置Nginx ========
# 创建Nginx配置目录和运行目录
RUN mkdir -p /etc/nginx/conf.d /var/log/nginx /run/nginx /var/cache/nginx

# 使用现有的nginx.conf作为站点配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 创建基础nginx配置
RUN echo 'user nginx;' > /etc/nginx/nginx.conf && \
    echo 'worker_processes auto;' >> /etc/nginx/nginx.conf && \
    echo 'error_log /var/log/nginx/error.log notice;' >> /etc/nginx/nginx.conf && \
    echo 'pid /var/run/nginx.pid;' >> /etc/nginx/nginx.conf && \
    echo 'events { worker_connections 1024; use epoll; multi_accept on; }' >> /etc/nginx/nginx.conf && \
    echo 'http {' >> /etc/nginx/nginx.conf && \
    echo '  include /etc/nginx/mime.types;' >> /etc/nginx/nginx.conf && \
    echo '  default_type application/octet-stream;' >> /etc/nginx/nginx.conf && \
    echo '  log_format main '"'"'$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for"'"'"';' >> /etc/nginx/nginx.conf && \
    echo '  access_log /var/log/nginx/access.log main;' >> /etc/nginx/nginx.conf && \
    echo '  sendfile on; tcp_nopush on; tcp_nodelay on; keepalive_timeout 65; types_hash_max_size 2048;' >> /etc/nginx/nginx.conf && \
    echo '  gzip on; gzip_vary on; gzip_min_length 1024; gzip_proxied any; gzip_comp_level 6;' >> /etc/nginx/nginx.conf && \
    echo '  gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;' >> /etc/nginx/nginx.conf && \
    echo '  include /etc/nginx/conf.d/*.conf;' >> /etc/nginx/nginx.conf && \
    echo '}' >> /etc/nginx/nginx.conf

# nginx用户已由nginx包自动创建

# ======== 一次性设置所有配置和目录 ========
RUN mkdir -p \
    /app/logs \
    /app/data/logs \
    /app/data/uploads \
    /app/data/thumbnails \
    /app/data/search-indexes \
    /app/database \
    /app/uploads \
    /app/thumbnails \
    /usr/share/nginx/html && \
    # 复制前端文件到nginx目录并清理源文件
    cp -r /app/frontend/dist/* /usr/share/nginx/html/ && \
    rm -rf /app/frontend && \
    # 设置目录权限 - 确保nobody用户有写权限
    chown -R nobody:nobody /app/logs /app/data /app/database /app/uploads /app/thumbnails && \
    chmod -R 755 /app/logs /app/data /app/database /app/uploads /app/thumbnails && \
    # 创建Supervisor配置
    printf '[supervisord]\nnodaemon=true\nuser=root\nlogfile=/dev/stdout\nlogfile_maxbytes=0\npidfile=/var/run/supervisord.pid\n\n[program:backend]\ncommand=/bin/sh -c "cd /app/backend && exec node server.js"\ndirectory=/app\nuser=nobody\nautostart=true\nautorestart=true\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\nstdout_events_enabled=true\nstderr_events_enabled=true\nenvironment=NODE_ENV=production,NODE_OPTIONS=--openssl-legacy-provider,PORT=3001,DB_PATH=/app/database/fshare.db,UPLOAD_PATH=/app/uploads,THUMBNAIL_PATH=/app/thumbnails,LOG_LEVEL=info\nstopwaitsecs=10\nkillasgroup=true\nstopasgroup=true\n\n[program:nginx]\ncommand=nginx -g "daemon off;"\nuser=root\nautostart=true\nautorestart=true\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\nstopwaitsecs=10\n\n[supervisorctl]\nserverurl=unix:///tmp/supervisor.sock\n\n[unix_http_server]\nfile=/tmp/supervisor.sock\n' > /etc/supervisord.conf && \
    # 创建启动脚本
    printf '#!/bin/sh\n\necho "🚀 启动 Quick FShare 单一容器..."\n\n# 确保所有目录存在并设置权限\necho "📁 确保目录结构..."\nmkdir -p /app/logs /app/data/logs /app/data/uploads /app/data/thumbnails /app/data/search-indexes /app/database /app/uploads /app/thumbnails\n\n# 设置正确的权限，确保nobody用户能够写入\nchown -R nobody:nobody /app/logs /app/data /app/database /app/uploads /app/thumbnails\nchmod -R 755 /app/logs /app/data /app/database /app/uploads /app/thumbnails\n\n# 特别确保日志目录权限\nchmod 755 /app/data/logs\nchown nobody:nobody /app/data/logs\n\n# 检查权限是否设置成功\necho "📋 检查权限设置:"\nls -la /app/data/\nls -la /app/data/logs/\n\n# 检查关键文件是否存在\nif [ ! -f "/app/backend/server.js" ]; then\n  echo "❌ 错误: backend/server.js 不存在"\n  exit 1\nfi\n\nif [ ! -f "/app/backend/package.json" ]; then\n  echo "❌ 错误: backend/package.json 不存在"\n  exit 1\nfi\n\n# 初始化数据库\necho "📊 初始化数据库..."\ncd /app/backend && node scripts/init-db.js\n\necho "✅ 初始化完成，启动服务..."\necho "📋 日志说明:"\necho "   - [SUPERVISOR] Supervisor 管理日志"\necho "   - [BACKEND] 后端服务日志"\necho "   - [NGINX] Nginx 服务日志"\necho "========================================="\n\n# 使用supervisor管理多个进程\nexec supervisord -c /etc/supervisord.conf\n' > /app/start.sh && \
    chmod +x /app/start.sh

# ======== 设置环境变量 ========
ENV NODE_ENV=production \
    PORT=3001 \
    NODE_OPTIONS=--openssl-legacy-provider \
    JWT_SECRET=your-super-secret-jwt-key-change-in-production \
    JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production \
    DB_PATH=/app/database/fshare.db \
    UPLOAD_PATH=/app/uploads \
    THUMBNAIL_PATH=/app/thumbnails \
    LOG_LEVEL=info \
    MAX_FILE_SIZE=104857600 \
    RATE_LIMIT_WINDOW=900000 \
    RATE_LIMIT_MAX=100

# ======== 暴露端口 ========
EXPOSE 80

# ======== 健康检查 ========
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost/health && curl -f http://localhost:3001/api/health || exit 1

# ======== 数据卷 ========
VOLUME ["/app/database", "/app/uploads", "/app/thumbnails", "/app/logs", "/app/data"]

# 使用dumb-init处理信号
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"] 