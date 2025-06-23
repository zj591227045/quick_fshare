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
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ======== 安装后端依赖 ========
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

COPY backend/ ./backend/

# ======== 复制数据库相关文件 ========
COPY database/ ./database/

# ======== 配置Nginx ========
# 创建Nginx配置目录
RUN mkdir -p /etc/nginx/conf.d /var/log/nginx /run/nginx

# 复制Nginx配置文件
COPY docker/nginx.conf /etc/nginx/nginx.conf

# ======== 设置应用目录结构 ========
RUN mkdir -p \
    /app/logs \
    /app/database \
    /app/uploads \
    /app/thumbnails \
    /usr/share/nginx/html

# 复制构建好的前端文件到Nginx目录
RUN cp -r /app/frontend/dist/* /usr/share/nginx/html/

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

# ======== 复制配置文件 ========
COPY docker/single-container.conf /etc/nginx/conf.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/start.sh /app/start.sh

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