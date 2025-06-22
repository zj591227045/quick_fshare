#!/bin/bash

# Quick FShare 数据恢复脚本
# 用法: ./scripts/restore.sh [备份文件路径]

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROJECT_NAME="quick-fshare"

# 参数
BACKUP_FILE=""
FORCE=false
NO_CONFIRM=false

# 日志函数
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# 帮助信息
show_help() {
    echo "Quick FShare 数据恢复脚本"
    echo ""
    echo "用法: $0 [备份文件路径] [选项]"
    echo ""
    echo "参数:"
    echo "  备份文件路径    要恢复的备份文件（.tar.gz格式）"
    echo ""
    echo "选项:"
    echo "  --force        强制恢复（覆盖现有数据）"
    echo "  --no-confirm   跳过确认提示"
    echo "  --help         显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 ./backups/quick-fshare_backup_20240101_120000.tar.gz"
    echo "  $0 ./backups/quick-fshare_backup_20240101_120000.tar.gz --force"
}

# 检查依赖
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose 未安装"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker 服务未运行"
        exit 1
    fi
}

# 验证备份文件
validate_backup() {
    if [ ! -f "$BACKUP_FILE" ]; then
        error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
    
    if [[ ! "$BACKUP_FILE" =~ \.tar\.gz$ ]]; then
        error "备份文件格式错误，只支持 .tar.gz 格式"
        exit 1
    fi
    
    log "验证备份文件: $BACKUP_FILE"
    
    # 检查tar文件是否有效
    if ! tar -tzf "$BACKUP_FILE" &> /dev/null; then
        error "备份文件损坏或格式无效"
        exit 1
    fi
    
    log "备份文件验证通过"
}

# 显示备份信息
show_backup_info() {
    local temp_dir=$(mktemp -d)
    local extract_dir="$temp_dir/extract"
    
    mkdir -p "$extract_dir"
    tar -xzf "$BACKUP_FILE" -C "$extract_dir"
    
    local backup_dir=$(find "$extract_dir" -maxdepth 1 -type d -name "*backup_*" | head -1)
    
    if [ -f "$backup_dir/backup_info.txt" ]; then
        info "备份信息:"
        echo "----------------------------------------"
        cat "$backup_dir/backup_info.txt"
        echo "----------------------------------------"
    else
        warn "未找到备份信息文件"
    fi
    
    # 清理临时目录
    rm -rf "$temp_dir"
}

# 检查现有服务
check_existing_services() {
    if docker-compose ps | grep -q "Up"; then
        warn "检测到服务正在运行"
        if [ "$FORCE" = false ]; then
            error "请先停止服务或使用 --force 选项"
            echo "停止服务: docker-compose down"
            exit 1
        else
            log "强制模式，将停止现有服务"
            docker-compose down
        fi
    fi
}

# 确认恢复操作
confirm_restore() {
    if [ "$NO_CONFIRM" = true ]; then
        return
    fi
    
    echo ""
    warn "警告：此操作将覆盖现有的所有数据！"
    echo "备份文件: $BACKUP_FILE"
    echo ""
    read -p "确认要继续恢复吗？(yes/no): " confirm
    
    if [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
        log "恢复操作已取消"
        exit 0
    fi
}

# 备份现有数据
backup_existing_data() {
    if [ "$FORCE" = false ]; then
        log "备份现有数据..."
        
        local backup_script="./scripts/backup.sh"
        if [ -f "$backup_script" ]; then
            "$backup_script" --force --quiet
            log "现有数据已备份"
        else
            warn "未找到备份脚本，跳过现有数据备份"
        fi
    fi
}

# 解压备份文件
extract_backup() {
    log "解压备份文件..."
    
    TEMP_DIR=$(mktemp -d)
    EXTRACT_DIR="$TEMP_DIR/extract"
    
    mkdir -p "$EXTRACT_DIR"
    tar -xzf "$BACKUP_FILE" -C "$EXTRACT_DIR"
    
    BACKUP_DIR=$(find "$EXTRACT_DIR" -maxdepth 1 -type d -name "*backup_*" | head -1)
    
    if [ ! -d "$BACKUP_DIR" ]; then
        error "备份文件结构无效"
        exit 1
    fi
    
    log "备份文件解压完成"
}

# 恢复数据库
restore_database() {
    if [ -f "$BACKUP_DIR/database.tar.gz" ]; then
        log "恢复数据库..."
        
        local volume_name="${PROJECT_NAME}_app_database"
        
        # 删除现有卷
        docker volume rm "$volume_name" 2>/dev/null || true
        
        # 创建新卷并恢复数据
        docker volume create "$volume_name"
        docker run --rm \
            -v "$volume_name:/target" \
            -v "$BACKUP_DIR:/backup" \
            alpine sh -c "cd /target && tar xzf /backup/database.tar.gz"
        
        log "数据库恢复完成"
    else
        warn "未找到数据库备份文件"
    fi
}

# 恢复上传文件
restore_uploads() {
    if [ -f "$BACKUP_DIR/uploads.tar.gz" ]; then
        log "恢复上传文件..."
        
        local volume_name="${PROJECT_NAME}_app_uploads"
        
        # 删除现有卷
        docker volume rm "$volume_name" 2>/dev/null || true
        
        # 创建新卷并恢复数据
        docker volume create "$volume_name"
        docker run --rm \
            -v "$volume_name:/target" \
            -v "$BACKUP_DIR:/backup" \
            alpine sh -c "cd /target && tar xzf /backup/uploads.tar.gz"
        
        log "上传文件恢复完成"
    else
        warn "未找到上传文件备份"
    fi
}

# 恢复缩略图
restore_thumbnails() {
    if [ -f "$BACKUP_DIR/thumbnails.tar.gz" ]; then
        log "恢复缩略图..."
        
        local volume_name="${PROJECT_NAME}_app_thumbnails"
        
        # 删除现有卷
        docker volume rm "$volume_name" 2>/dev/null || true
        
        # 创建新卷并恢复数据
        docker volume create "$volume_name"
        docker run --rm \
            -v "$volume_name:/target" \
            -v "$BACKUP_DIR:/backup" \
            alpine sh -c "cd /target && tar xzf /backup/thumbnails.tar.gz"
        
        log "缩略图恢复完成"
    else
        warn "未找到缩略图备份"
    fi
}

# 恢复日志
restore_logs() {
    if [ -f "$BACKUP_DIR/logs.tar.gz" ]; then
        log "恢复日志文件..."
        
        local volume_name="${PROJECT_NAME}_app_logs"
        
        # 删除现有卷
        docker volume rm "$volume_name" 2>/dev/null || true
        
        # 创建新卷并恢复数据
        docker volume create "$volume_name"
        docker run --rm \
            -v "$volume_name:/target" \
            -v "$BACKUP_DIR:/backup" \
            alpine sh -c "cd /target && tar xzf /backup/logs.tar.gz"
        
        log "日志文件恢复完成"
    else
        warn "未找到日志文件备份"
    fi
}

# 恢复配置文件
restore_configs() {
    log "恢复配置文件..."
    
    # 恢复环境变量文件
    if [ -f "$BACKUP_DIR/env.backup" ]; then
        cp "$BACKUP_DIR/env.backup" .env
        log "环境变量文件已恢复"
    else
        warn "未找到环境变量文件备份"
    fi
    
    # 恢复Docker配置
    if [ -d "$BACKUP_DIR/docker" ]; then
        cp -r "$BACKUP_DIR/docker" ./
        log "Docker配置文件已恢复"
    else
        warn "未找到Docker配置文件备份"
    fi
    
    log "配置文件恢复完成"
}

# 清理临时文件
cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        log "临时文件清理完成"
    fi
}

# 启动服务
start_services() {
    log "启动服务..."
    
    docker-compose up -d
    
    # 等待服务启动
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost/health &> /dev/null; then
            log "服务启动成功"
            return 0
        fi
        
        log "等待服务启动... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    warn "服务启动超时，请检查日志"
    return 1
}

# 验证恢复结果
verify_restore() {
    log "验证恢复结果..."
    
    # 检查容器状态
    if ! docker-compose ps | grep -q "Up"; then
        error "服务未正常启动"
        return 1
    fi
    
    # 检查健康状态
    if curl -f http://localhost/health &> /dev/null; then
        log "服务健康检查通过"
    else
        warn "服务健康检查失败"
    fi
    
    log "恢复验证完成"
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
            --no-confirm)
                NO_CONFIRM=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            -*)
                error "未知选项: $1"
                show_help
                exit 1
                ;;
            *)
                if [ -z "$BACKUP_FILE" ]; then
                    BACKUP_FILE="$1"
                else
                    error "只能指定一个备份文件"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # 检查必需参数
    if [ -z "$BACKUP_FILE" ]; then
        error "请指定备份文件路径"
        show_help
        exit 1
    fi
    
    log "开始恢复 Quick FShare 数据..."
    
    # 执行恢复流程
    check_dependencies
    validate_backup
    show_backup_info
    check_existing_services
    confirm_restore
    backup_existing_data
    extract_backup
    restore_database
    restore_uploads
    restore_thumbnails
    restore_logs
    restore_configs
    start_services
    verify_restore
    cleanup
    
    log "数据恢复完成！"
    info "服务访问地址: http://localhost"
}

# 捕获错误和退出信号
trap 'error "恢复过程中发生错误"; cleanup' ERR
trap 'cleanup' EXIT

# 执行主函数
main "$@" 