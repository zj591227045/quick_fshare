#!/bin/bash

# Quick FShare 数据备份脚本
# 用法: ./scripts/backup.sh [选项]

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 配置
PROJECT_NAME="quick-fshare"
BACKUP_DIR="./backups"
RETENTION_DAYS=30

# 参数
FORCE=false
QUIET=false

# 日志函数
log() {
    if [ "$QUIET" = false ]; then
        echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    fi
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 帮助信息
show_help() {
    echo "Quick FShare 数据备份脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --force    强制备份（即使服务正在运行）"
    echo "  --quiet    静默模式"
    echo "  --help     显示此帮助信息"
    echo ""
}

# 检查Docker环境
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker 服务未运行"
        exit 1
    fi
}

# 检查服务状态
check_services() {
    if [ "$FORCE" = false ]; then
        if docker-compose ps | grep -q "Up"; then
            warn "检测到服务正在运行，备份可能包含不一致的数据"
            echo "使用 --force 选项强制备份，或先停止服务"
            exit 1
        fi
    fi
}

# 创建备份目录
create_backup_dir() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/${PROJECT_NAME}_backup_$timestamp"
    
    mkdir -p "$BACKUP_PATH"
    log "创建备份目录: $BACKUP_PATH"
}

# 备份数据库
backup_database() {
    local volume_name="${PROJECT_NAME}_app_database"
    
    if docker volume ls | grep -q "$volume_name"; then
        log "备份数据库..."
        docker run --rm \
            -v "$volume_name:/source:ro" \
            -v "$(pwd)/$BACKUP_PATH:/backup" \
            alpine sh -c "cd /source && tar czf /backup/database.tar.gz ."
        
        log "数据库备份完成"
    else
        warn "数据库卷不存在，跳过备份"
    fi
}

# 备份上传文件
backup_uploads() {
    local volume_name="${PROJECT_NAME}_app_uploads"
    
    if docker volume ls | grep -q "$volume_name"; then
        log "备份上传文件..."
        docker run --rm \
            -v "$volume_name:/source:ro" \
            -v "$(pwd)/$BACKUP_PATH:/backup" \
            alpine sh -c "cd /source && tar czf /backup/uploads.tar.gz ."
        
        log "上传文件备份完成"
    else
        warn "上传文件卷不存在，跳过备份"
    fi
}

# 备份缩略图
backup_thumbnails() {
    local volume_name="${PROJECT_NAME}_app_thumbnails"
    
    if docker volume ls | grep -q "$volume_name"; then
        log "备份缩略图..."
        docker run --rm \
            -v "$volume_name:/source:ro" \
            -v "$(pwd)/$BACKUP_PATH:/backup" \
            alpine sh -c "cd /source && tar czf /backup/thumbnails.tar.gz ."
        
        log "缩略图备份完成"
    else
        warn "缩略图卷不存在，跳过备份"
    fi
}

# 备份日志
backup_logs() {
    local volume_name="${PROJECT_NAME}_app_logs"
    
    if docker volume ls | grep -q "$volume_name"; then
        log "备份日志文件..."
        docker run --rm \
            -v "$volume_name:/source:ro" \
            -v "$(pwd)/$BACKUP_PATH:/backup" \
            alpine sh -c "cd /source && tar czf /backup/logs.tar.gz ."
        
        log "日志文件备份完成"
    else
        warn "日志卷不存在，跳过备份"
    fi
}

# 备份配置文件
backup_configs() {
    log "备份配置文件..."
    
    # 备份环境变量文件
    if [ -f ".env" ]; then
        cp .env "$BACKUP_PATH/env.backup"
    fi
    
    # 备份Docker Compose文件
    cp docker-compose.yml "$BACKUP_PATH/"
    if [ -f "docker-compose.dev.yml" ]; then
        cp docker-compose.dev.yml "$BACKUP_PATH/"
    fi
    
    # 备份Nginx配置
    if [ -d "docker" ]; then
        cp -r docker "$BACKUP_PATH/"
    fi
    
    log "配置文件备份完成"
}

# 创建备份信息文件
create_backup_info() {
    local info_file="$BACKUP_PATH/backup_info.txt"
    
    cat > "$info_file" << EOF
Quick FShare 备份信息
===================
备份时间: $(date)
项目名称: $PROJECT_NAME
备份路径: $BACKUP_PATH
Docker版本: $(docker --version)
主机信息: $(uname -a)

备份内容:
- 数据库: database.tar.gz
- 上传文件: uploads.tar.gz
- 缩略图: thumbnails.tar.gz
- 日志文件: logs.tar.gz
- 配置文件: env.backup, docker-compose.yml, docker/

恢复方法:
1. 停止现有服务: docker-compose down
2. 恢复数据卷: docker run --rm -v project_app_database:/target -v \$(pwd):/backup alpine sh -c "cd /target && tar xzf /backup/database.tar.gz"
3. 恢复配置文件: cp env.backup .env
4. 重启服务: docker-compose up -d
EOF
    
    log "备份信息文件创建完成"
}

# 清理旧备份
cleanup_old_backups() {
    log "清理超过 ${RETENTION_DAYS} 天的旧备份..."
    
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "${PROJECT_NAME}_backup_*" -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true
    fi
    
    log "旧备份清理完成"
}

# 压缩备份
compress_backup() {
    log "压缩备份文件..."
    
    local archive_name="${BACKUP_PATH}.tar.gz"
    tar czf "$archive_name" -C "$BACKUP_DIR" "$(basename "$BACKUP_PATH")"
    
    # 删除原始备份目录
    rm -rf "$BACKUP_PATH"
    
    log "备份已压缩: $archive_name"
    
    # 显示备份大小
    local size=$(du -h "$archive_name" | cut -f1)
    log "备份大小: $size"
}

# 主函数
main() {
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE=true
                shift
                ;;
            --quiet)
                QUIET=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log "开始备份 Quick FShare 数据..."
    
    # 执行备份流程
    check_docker
    check_services
    create_backup_dir
    backup_database
    backup_uploads
    backup_thumbnails
    backup_logs
    backup_configs
    create_backup_info
    compress_backup
    cleanup_old_backups
    
    log "备份完成！"
}

# 捕获错误
trap 'error "备份过程中发生错误"' ERR

# 执行主函数
main "$@" 