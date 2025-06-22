# Quick FShare - 私有文件快速分享系统

![Quick FShare Logo](docs/assets/logo.png)

[![GitHub release](https://img.shields.io/github/release/quickfshare/quickfshare.svg)](https://github.com/quickfshare/quickfshare/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/quickfshare/quickfshare.svg)](https://hub.docker.com/r/quickfshare/quickfshare)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Quick FShare 是一个基于Web的私有文件分享系统，支持快速、美观、安全的文件分享功能。支持本地文件系统、SMB和NFS协议，提供现代化的用户界面和完整的管理功能。

## ✨ 特性

- 🚀 **快速部署** - 一键Docker部署，5分钟内即可使用
- 🎨 **现代界面** - 基于React + Ant Design的美观界面
- 🌓 **主题支持** - 明暗主题切换，个性化体验
- 🔒 **安全可靠** - JWT认证，密码保护，访问控制
- 📁 **多协议支持** - 本地文件系统、SMB、NFS
- 🖼️ **缩略图预览** - 图片、视频、PDF缩略图
- 📱 **响应式设计** - 完美适配移动端
- 📊 **系统监控** - 实时状态监控和日志管理
- 🔄 **自动备份** - 数据自动备份和恢复
- 🌐 **多语言支持** - 中英文界面

## 🚀 快速开始

### 使用Docker (推荐)

```bash
# 克隆项目
git clone https://github.com/your-username/Quick_FShare.git
cd Quick_FShare

# 启动服务
./scripts/manage.sh start

# 或者使用Docker Compose
docker-compose up -d
```

### 访问系统

- **Web界面**: http://localhost
- **管理后台**: http://localhost/admin
- **API接口**: http://localhost/api

默认管理员账号：
- 用户名: `admin`
- 密码: `admin123`

⚠️ **重要**: 首次登录后请立即修改默认密码！

## 📋 系统要求

### 最低要求
- **操作系统**: Linux / macOS / Windows
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **内存**: 512MB
- **磁盘**: 1GB

### 推荐配置
- **内存**: 2GB+
- **磁盘**: 10GB+
- **CPU**: 2核+

## 🛠️ 安装指南

### 1. 环境准备

#### 安装Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# CentOS/RHEL
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# macOS
brew install docker

# Windows
# 下载并安装 Docker Desktop
```

#### 安装Docker Compose
```bash
# Linux
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# macOS/Windows
# Docker Desktop 已包含 Docker Compose
```

### 2. 项目部署

#### 方式一：快速部署脚本
```bash
# 下载项目
git clone https://github.com/your-username/Quick_FShare.git
cd Quick_FShare

# 初始化项目
./scripts/manage.sh init

# 启动服务
./scripts/manage.sh start
```

#### 方式二：手动部署
```bash
# 下载项目
git clone https://github.com/your-username/Quick_FShare.git
cd Quick_FShare

# 复制环境变量文件
cp .env.example .env

# 编辑配置文件
vim .env

# 启动服务
docker-compose up -d
```

### 3. 配置文件

创建 `.env` 文件并配置以下参数：

```env
# JWT 密钥 (必须修改)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# 系统配置
LOG_LEVEL=info
MAX_FILE_SIZE=104857600

# 共享目录路径
SHARED_VOLUMES=./data

# 监控配置
MONITORING_INTERVAL=60
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=80
```

## 📖 使用指南

### 管理员功能

#### 1. 登录系统
访问 `http://localhost` 使用管理员账号登录。

#### 2. 添加分享路径
1. 点击"分享管理" → "添加分享"
2. 选择分享类型：本地/SMB/NFS
3. 配置路径和权限
4. 设置密码保护（可选）

#### 3. 用户管理
- 修改管理员密码
- 查看访问日志
- 管理系统设置

#### 4. 系统监控
- 实时查看系统状态
- 查看访问统计
- 监控资源使用

### 用户功能

#### 1. 浏览文件
- 支持文件夹导航
- 文件搜索功能
- 缩略图预览

#### 2. 下载文件
- 单文件下载
- 批量下载（打包）
- 断点续传支持

#### 3. 移动端使用
- 响应式界面
- 触摸友好操作
- PWA支持

## 🔧 管理命令

项目提供了完整的管理脚本：

```bash
# 项目管理
./scripts/manage.sh start          # 启动服务
./scripts/manage.sh stop           # 停止服务
./scripts/manage.sh restart        # 重启服务
./scripts/manage.sh status         # 查看状态
./scripts/manage.sh logs           # 查看日志
./scripts/manage.sh update         # 更新服务

# 数据管理
./scripts/backup.sh               # 备份数据
./scripts/restore.sh backup.tar.gz # 恢复数据

# 系统监控
./scripts/monitor.sh              # 系统监控
./scripts/monitor.sh --continuous # 持续监控

# 部署脚本
./scripts/deploy.sh production    # 生产环境部署
./scripts/deploy.sh development   # 开发环境部署
```

## 🔐 安全设置

### 1. 修改默认密码
首次登录后立即修改管理员密码。

### 2. 配置JWT密钥
在 `.env` 文件中设置强密码：
```env
JWT_SECRET=your-very-long-and-random-secret-key-here
JWT_REFRESH_SECRET=another-very-long-and-random-secret-key-here
```

### 3. 启用HTTPS
使用反向代理配置SSL证书：
```bash
# 使用Nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. 防火墙设置
```bash
# 只开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 📊 监控和运维

### 系统监控
```bash
# 实时监控
./scripts/monitor.sh --continuous

# JSON格式输出
./scripts/monitor.sh --json

# 详细信息
./scripts/monitor.sh --detail
```

### 日志管理
```bash
# 查看服务日志
./scripts/manage.sh logs --follow

# 查看特定行数
./scripts/manage.sh logs --tail 100

# 查看错误日志
docker-compose logs | grep ERROR
```

### 备份策略
```bash
# 自动备份 (建议添加到crontab)
0 2 * * * /path/to/Quick_FShare/scripts/backup.sh --quiet

# 手动备份
./scripts/backup.sh

# 恢复备份
./scripts/restore.sh backup_file.tar.gz
```

## 🛠️ 开发指南

### 开发环境搭建
```bash
# 克隆项目
git clone https://github.com/your-username/Quick_FShare.git
cd Quick_FShare

# 启动开发环境
./scripts/manage.sh start --env development

# 或者
docker-compose -f docker-compose.dev.yml up -d
```

### 开发服务地址
- **前端**: http://localhost:5173
- **后端**: http://localhost:3001
- **API**: http://localhost:3001/api

### 项目结构
```
Quick_FShare/
├── frontend/          # React 前端
├── backend/           # Node.js 后端
├── database/          # 数据库相关
├── docker/            # Docker 配置
├── scripts/           # 管理脚本
├── docs/              # 项目文档
└── data/              # 共享数据目录
```

### 代码规范
- ESLint + Prettier
- 提交前自动检查
- 遵循 Git Flow 工作流

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 贡献方式
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 问题反馈
- [GitHub Issues](https://github.com/your-username/Quick_FShare/issues)
- [功能请求](https://github.com/your-username/Quick_FShare/issues/new?template=feature_request.md)
- [Bug报告](https://github.com/your-username/Quick_FShare/issues/new?template=bug_report.md)

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [React](https://reactjs.org/) - 用户界面框架
- [Ant Design](https://ant.design/) - UI组件库
- [Node.js](https://nodejs.org/) - 后端运行环境
- [Express.js](https://expressjs.com/) - Web框架
- [Docker](https://www.docker.com/) - 容器化平台

## 📞 联系我们

- **项目主页**: https://github.com/your-username/Quick_FShare
- **文档**: https://your-username.github.io/Quick_FShare
- **Email**: your-email@example.com

---

⭐ 如果这个项目对你有帮助，请给我们一个Star！ 