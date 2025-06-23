# Quick FShare 单一容器部署
# 将前端、后端、数据库打包为单一容器

# 使用包含Node.js的基础镜像
FROM node:18-alpine

# 安装必要的系统工具
RUN apk add --no-cache \
    nginx \
    sqlite \
    curl \
    supervisor \
    dumb-init

# 设置工作目录
WORKDIR /app

# ======== 构建前端 ========
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --verbose

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ======== 安装后端依赖 ========
COPY backend/package*.json ./backend/
RUN cd backend && npm install --only=production --verbose

COPY backend/ ./backend/
RUN cd backend && npm run build && npm run verify

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

# 创建nginx用户
RUN addgroup -g 101 -S nginx && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# ======== 设置应用目录结构 ========
RUN mkdir -p \
    /app/logs \
    /app/database \
    /app/uploads \
    /app/thumbnails \
    /usr/share/nginx/html

# 复制构建好的前端文件到Nginx目录
RUN cp -r /app/frontend/dist/* /usr/share/nginx/html/

# ======== 创建Supervisor配置 ========
RUN printf '[supervisord]\nnodaemon=true\nuser=root\nlogfile=/var/log/supervisord.log\npidfile=/var/run/supervisord.pid\n\n[program:backend]\ncommand=node server.js\ndirectory=/app/backend\nuser=nobody\nautostart=true\nautorestart=true\nstderr_logfile=/var/log/backend-error.log\nstdout_logfile=/var/log/backend.log\nenvironment=NODE_ENV=production,PORT=3001,DB_PATH=/app/database/fshare.db,UPLOAD_PATH=/app/uploads,THUMBNAIL_PATH=/app/thumbnails,LOG_LEVEL=info\n\n[program:nginx]\ncommand=nginx -g "daemon off;"\nuser=root\nautostart=true\nautorestart=true\nstderr_logfile=/var/log/nginx-error.log\nstdout_logfile=/var/log/nginx.log\n\n[supervisorctl]\nserverurl=unix:///tmp/supervisor.sock\n\n[unix_http_server]\nfile=/tmp/supervisor.sock\n' > /etc/supervisord.conf

# ======== 创建启动脚本 ========
RUN printf '#!/bin/sh\n\necho "🚀 启动 Quick FShare 单一容器..."\n\n# 初始化数据库\necho "📊 初始化数据库..."\ncd /app/backend && node scripts/init-db.js\n\n# 设置权限\necho "🔐 设置文件权限..."\nchown -R nobody:nobody /app/logs /app/database /app/uploads /app/thumbnails\nchmod -R 755 /app/logs /app/database /app/uploads /app/thumbnails\n\necho "✅ 初始化完成，启动服务..."\n\n# 使用supervisor管理多个进程\nexec supervisord -c /etc/supervisord.conf\n' > /app/start.sh

# ======== 设置环境变量 ========
ENV NODE_ENV=production \
    PORT=3001 \
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
VOLUME ["/app/database", "/app/uploads", "/app/thumbnails", "/app/logs"]

# ======== 启动容器 ========
RUN chmod +x /app/start.sh

# 使用dumb-init处理信号
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"] 