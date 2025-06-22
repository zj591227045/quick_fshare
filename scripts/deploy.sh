#!/bin/bash

# Quick FShare 自动化部署脚本
# 用法: ./scripts/deploy.sh [环境] [选项]
# 环境: production | development
# 选项: --rebuild | --no-backup | --help

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="quick-fshare"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"

# 默认参数
ENVIRONMENT="production"
REBUILD=false
NO_BACKUP=false

# 帮助信息
show_help() {
    echo "Quick FShare 部署脚本"
    echo ""
    echo "用法: $0 [环境] [选项]"
    echo ""
    echo "环境:"
    echo "  production   生产环境部署 (默认)"
    echo "  development  开发环境部署"
    echo ""
    echo "选项:"
    echo "  --rebuild    强制重新构建镜像"
    echo "  --no-backup  跳过数据备份"
    echo "  --help       显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 production --rebuild"
    echo "  $0 development"
}

# 日志函数
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# 检查依赖
check_dependencies() {
    log "INFO" "检查系统依赖..."
    
    if ! command -v docker &> /dev/null; then
        log "ERROR" "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log "ERROR" "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log "INFO" "系统依赖检查通过"
}

# 创建必要目录
create_directories() {
    log "INFO" "创建必要目录..."
    
    mkdir -p logs
    mkdir -p data
    mkdir -p backups
    
    if [ ! -f "$LOG_FILE" ]; then
        touch "$LOG_FILE"
    fi
    
    log "INFO" "目录创建完成"
}

# 备份数据
backup_data() {
    if [ "$NO_BACKUP" = true ]; then
        log "WARN" "跳过数据备份"
        return
    fi
    
    log "INFO" "开始备份数据..."
    
    local backup_name="${PROJECT_NAME}_backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    # 备份数据库
    if docker volume ls | grep -q "${PROJECT_NAME}_app_database"; then
        log "INFO" "备份数据库..."
        docker run --rm \
            -v "${PROJECT_NAME}_app_database:/source:ro" \
            -v "$(pwd)/$backup_path:/backup" \
            alpine sh -c "cd /source && tar czf /backup/database.tar.gz ."
    fi
    
    # 备份上传文件
    if docker volume ls | grep -q "${PROJECT_NAME}_app_uploads"; then
        log "INFO" "备份上传文件..."
        docker run --rm \
            -v "${PROJECT_NAME}_app_uploads:/source:ro" \
            -v "$(pwd)/$backup_path:/backup" \
            alpine sh -c "cd /source && tar czf /backup/uploads.tar.gz ."
    fi
    
    # 备份配置文件
    if [ -f ".env" ]; then
        cp .env "$backup_path/env.backup"
    fi
    
    log "INFO" "数据备份完成: $backup_path"
}

# 清理旧备份
cleanup_old_backups() {
    log "INFO" "清理旧备份文件..."
    
    # 保留最近30个备份
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "${PROJECT_NAME}_backup_*" -type d | \
            sort -r | tail -n +31 | xargs -r rm -rf
    fi
    
    log "INFO" "旧备份清理完成"
}

# 检查环境配置
check_environment() {
    log "INFO" "检查环境配置..."
    
    local env_file=".env"
    if [ "$ENVIRONMENT" = "production" ]; then
        if [ ! -f "$env_file" ]; then
            if [ -f "docker/.env.production" ]; then
                log "WARN" "未找到 .env 文件，复制生产环境模板..."
                cp "docker/.env.production" "$env_file"
                log "WARN" "请编辑 .env 文件并修改相应的配置"
            else
                log "ERROR" "未找到环境配置文件"
                exit 1
            fi
        fi
    fi
    
    log "INFO" "环境配置检查完成"
}

# 部署应用
deploy_application() {
    log "INFO" "开始部署 $ENVIRONMENT 环境..."
    
    local compose_file="docker-compose.yml"
    local compose_args=""
    
    if [ "$ENVIRONMENT" = "development" ]; then
        compose_file="docker-compose.dev.yml"
    fi
    
    if [ "$REBUILD" = true ]; then
        compose_args="--build --force-recreate"
        log "INFO" "强制重新构建镜像..."
    fi
    
    # 停止现有服务
    log "INFO" "停止现有服务..."
    docker-compose -f "$compose_file" down
    
    # 拉取最新镜像（如果使用预构建镜像）
    if [ "$REBUILD" = false ]; then
        log "INFO" "拉取最新镜像..."
        docker-compose -f "$compose_file" pull || true
    fi
    
    # 启动服务
    log "INFO" "启动服务..."
    docker-compose -f "$compose_file" up -d $compose_args
    
    log "INFO" "部署完成"
}

# 等待服务启动
wait_for_services() {
    log "INFO" "等待服务启动..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost/health &> /dev/null; then
            log "INFO" "服务启动成功"
            return 0
        fi
        
        log "DEBUG" "等待服务启动... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    log "ERROR" "服务启动超时"
    return 1
}

# 显示服务状态
show_status() {
    log "INFO" "服务状态:"
    
    local compose_file="docker-compose.yml"
    if [ "$ENVIRONMENT" = "development" ]; then
        compose_file="docker-compose.dev.yml"
    fi
    
    docker-compose -f "$compose_file" ps
    
    echo ""
    log "INFO" "服务访问地址:"
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "  前端: http://localhost"
        echo "  API:  http://localhost/api"
    else
        echo "  前端: http://localhost:5173"
        echo "  API:  http://localhost:3001/api"
    fi
}

# 主函数
main() {
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            production|development)
                ENVIRONMENT="$1"
                shift
                ;;
            --rebuild)
                REBUILD=true
                shift
                ;;
            --no-backup)
                NO_BACKUP=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log "ERROR" "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log "INFO" "开始部署 Quick FShare ($ENVIRONMENT 环境)..."
    
    # 执行部署流程
    check_dependencies
    create_directories
    check_environment
    backup_data
    cleanup_old_backups
    deploy_application
    
    if wait_for_services; then
        show_status
        log "INFO" "部署成功完成！"
    else
        log "ERROR" "部署失败，请检查日志: $LOG_FILE"
        exit 1
    fi
}

# 捕获错误
trap 'log "ERROR" "部署过程中发生错误"' ERR

# 执行主函数
main "$@" 