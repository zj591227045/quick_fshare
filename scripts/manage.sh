#!/bin/bash

# Quick FShare 项目管理脚本
# 用法: ./scripts/manage.sh [命令] [选项]

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROJECT_NAME="quick-fshare"

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
    echo "Quick FShare 项目管理脚本"
    echo ""
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  start        启动服务"
    echo "  stop         停止服务"
    echo "  restart      重启服务"
    echo "  status       查看状态"
    echo "  logs         查看日志"
    echo "  update       更新服务"
    echo "  cleanup      清理资源"
    echo "  backup       备份数据"
    echo "  restore      恢复数据"
    echo "  init         初始化项目"
    echo ""
    echo "选项:"
    echo "  --env        指定环境 (production|development)"
    echo "  --follow     跟踪日志输出"
    echo "  --tail       显示日志行数"
    echo "  --rebuild    强制重新构建"
    echo "  --help       显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start --env production"
    echo "  $0 logs --follow --tail 100"
    echo "  $0 update --rebuild"
}

# 检查依赖
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker 服务未运行，请启动 Docker 服务"
        exit 1
    fi
}

# 获取Docker Compose文件
get_compose_file() {
    local env=${1:-production}
    
    if [ "$env" = "development" ]; then
        echo "docker-compose.dev.yml"
    else
        echo "docker-compose.yml"
    fi
}

# 启动服务
start_services() {
    local env=${1:-production}
    local rebuild=${2:-false}
    local compose_file=$(get_compose_file $env)
    
    log "启动 $env 环境的服务..."
    
    if [ ! -f "$compose_file" ]; then
        error "未找到 Docker Compose 配置文件: $compose_file"
        exit 1
    fi
    
    local compose_args=""
    if [ "$rebuild" = true ]; then
        compose_args="--build --force-recreate"
        log "强制重新构建镜像..."
    fi
    
    docker-compose -f "$compose_file" up -d $compose_args
    
    log "服务启动完成"
    
    # 等待服务启动
    log "等待服务启动..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost/health &> /dev/null; then
            log "服务启动成功"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            warn "服务启动超时，请检查日志"
            break
        fi
        
        sleep 2
        ((attempt++))
    done
    
    # 显示服务状态
    show_status $env
}

# 停止服务
stop_services() {
    local env=${1:-production}
    local compose_file=$(get_compose_file $env)
    
    log "停止服务..."
    
    if [ -f "$compose_file" ]; then
        docker-compose -f "$compose_file" down
        log "服务已停止"
    else
        warn "未找到 Docker Compose 配置文件，尝试停止所有相关容器"
        docker ps --filter "name=$PROJECT_NAME" -q | xargs -r docker stop
        docker ps -a --filter "name=$PROJECT_NAME" -q | xargs -r docker rm
    fi
}

# 重启服务
restart_services() {
    local env=${1:-production}
    local rebuild=${2:-false}
    
    log "重启服务..."
    stop_services $env
    sleep 2
    start_services $env $rebuild
}

# 查看状态
show_status() {
    local env=${1:-production}
    local compose_file=$(get_compose_file $env)
    
    info "=== 服务状态 ==="
    
    if [ -f "$compose_file" ]; then
        docker-compose -f "$compose_file" ps
    else
        warn "未找到 Docker Compose 配置文件"
        return
    fi
    
    echo ""
    info "=== 健康检查 ==="
    
    # 检查前端
    if curl -f -s http://localhost/health &> /dev/null; then
        echo -e "前端服务: ${GREEN}正常${NC}"
    else
        echo -e "前端服务: ${RED}异常${NC}"
    fi
    
    # 检查后端
    if curl -f -s http://localhost:3001/api/health &> /dev/null; then
        echo -e "后端服务: ${GREEN}正常${NC}"
    else
        echo -e "后端服务: ${RED}异常${NC}"
    fi
    
    echo ""
    info "=== 访问地址 ==="
    if [ "$env" = "production" ]; then
        echo "前端: http://localhost"
        echo "API:  http://localhost/api"
    else
        echo "前端: http://localhost:5173"
        echo "API:  http://localhost:3001/api"
    fi
}

# 查看日志
show_logs() {
    local env=${1:-production}
    local follow=${2:-false}
    local tail=${3:-50}
    local compose_file=$(get_compose_file $env)
    
    if [ ! -f "$compose_file" ]; then
        error "未找到 Docker Compose 配置文件: $compose_file"
        exit 1
    fi
    
    local log_args="--tail $tail"
    if [ "$follow" = true ]; then
        log_args="$log_args -f"
    fi
    
    docker-compose -f "$compose_file" logs $log_args
}

# 更新服务
update_services() {
    local env=${1:-production}
    local rebuild=${2:-false}
    local compose_file=$(get_compose_file $env)
    
    log "更新服务..."
    
    # 备份当前数据
    if [ -f "./scripts/backup.sh" ]; then
        log "创建更新前备份..."
        ./scripts/backup.sh --force --quiet
    fi
    
    # 拉取最新镜像（如果不是重新构建）
    if [ "$rebuild" = false ]; then
        log "拉取最新镜像..."
        docker-compose -f "$compose_file" pull
    fi
    
    # 重启服务
    restart_services $env $rebuild
    
    log "服务更新完成"
}

# 清理资源
cleanup_resources() {
    log "清理 Docker 资源..."
    
    # 停止所有相关容器
    docker ps --filter "name=$PROJECT_NAME" -q | xargs -r docker stop
    docker ps -a --filter "name=$PROJECT_NAME" -q | xargs -r docker rm
    
    # 清理未使用的镜像
    docker image prune -f
    
    # 清理未使用的网络
    docker network prune -f
    
    # 清理未使用的卷（谨慎操作）
    read -p "是否清理未使用的数据卷？这可能会删除重要数据 (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        docker volume prune -f
        warn "数据卷已清理"
    fi
    
    # 清理构建缓存
    docker builder prune -f
    
    log "资源清理完成"
}

# 备份数据
backup_data() {
    if [ -f "./scripts/backup.sh" ]; then
        log "执行数据备份..."
        ./scripts/backup.sh "$@"
    else
        error "未找到备份脚本"
        exit 1
    fi
}

# 恢复数据
restore_data() {
    if [ -f "./scripts/restore.sh" ]; then
        log "执行数据恢复..."
        ./scripts/restore.sh "$@"
    else
        error "未找到恢复脚本"
        exit 1
    fi
}

# 初始化项目
init_project() {
    log "初始化 Quick FShare 项目..."
    
    # 检查依赖
    check_dependencies
    
    # 创建必要目录
    mkdir -p logs data backups uploads
    
    # 创建环境变量文件
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        log "创建环境变量文件..."
        cp .env.example .env
        warn "请编辑 .env 文件并修改相应的配置"
    fi
    
    # 初始化数据库
    local backend_init_script="./backend/scripts/init-db.js"
    if [ -f "$backend_init_script" ]; then
        log "初始化数据库..."
        # 这里可以添加数据库初始化逻辑
    fi
    
    # 设置文件权限
    if [ -d "./scripts" ]; then
        chmod +x ./scripts/*.sh
        log "设置脚本执行权限"
    fi
    
    log "项目初始化完成"
    info "下一步: 运行 '$0 start' 启动服务"
}

# 显示快速操作菜单
show_menu() {
    echo ""
    echo "=== Quick FShare 管理菜单 ==="
    echo "1. 启动服务"
    echo "2. 停止服务"
    echo "3. 重启服务"
    echo "4. 查看状态"
    echo "5. 查看日志"
    echo "6. 备份数据"
    echo "7. 系统监控"
    echo "8. 清理资源"
    echo "0. 退出"
    echo ""
    read -p "请选择操作 (0-8): " choice
    
    case $choice in
        1)
            start_services
            ;;
        2)
            stop_services
            ;;
        3)
            restart_services
            ;;
        4)
            show_status
            ;;
        5)
            show_logs
            ;;
        6)
            backup_data
            ;;
        7)
            if [ -f "./scripts/monitor.sh" ]; then
                ./scripts/monitor.sh
            else
                error "未找到监控脚本"
            fi
            ;;
        8)
            cleanup_resources
            ;;
        0)
            log "退出管理脚本"
            exit 0
            ;;
        *)
            error "无效选择"
            show_menu
            ;;
    esac
}

# 主函数
main() {
    local command=""
    local env="production"
    local follow=false
    local tail=50
    local rebuild=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            start|stop|restart|status|logs|update|cleanup|backup|restore|init)
                command="$1"
                shift
                ;;
            --env)
                env="$2"
                shift 2
                ;;
            --follow|-f)
                follow=true
                shift
                ;;
            --tail|-t)
                tail="$2"
                shift 2
                ;;
            --rebuild)
                rebuild=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                # 对于backup和restore命令，传递剩余参数
                if [ "$command" = "backup" ] || [ "$command" = "restore" ]; then
                    break
                fi
                error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 如果没有指定命令，显示菜单
    if [ -z "$command" ]; then
        show_menu
        return
    fi
    
    # 执行命令
    case $command in
        start)
            check_dependencies
            start_services $env $rebuild
            ;;
        stop)
            stop_services $env
            ;;
        restart)
            check_dependencies
            restart_services $env $rebuild
            ;;
        status)
            show_status $env
            ;;
        logs)
            show_logs $env $follow $tail
            ;;
        update)
            check_dependencies
            update_services $env $rebuild
            ;;
        cleanup)
            cleanup_resources
            ;;
        backup)
            backup_data "$@"
            ;;
        restore)
            restore_data "$@"
            ;;
        init)
            init_project
            ;;
        *)
            error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@" 