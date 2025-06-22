#!/bin/bash

# Quick FShare 系统监控脚本
# 用法: ./scripts/monitor.sh [选项]

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
PROJECT_NAME="quick-fshare"
REFRESH_INTERVAL=5

# 参数
CONTINUOUS=false
JSON_OUTPUT=false
DETAIL=false

# 帮助信息
show_help() {
    echo "Quick FShare 系统监控脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --continuous  持续监控模式（每${REFRESH_INTERVAL}秒刷新）"
    echo "  --json        JSON格式输出"
    echo "  --detail      显示详细信息"
    echo "  --help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                   # 显示当前状态"
    echo "  $0 --continuous      # 持续监控"
    echo "  $0 --json            # JSON格式输出"
}

# 获取容器状态
get_container_status() {
    local status=""
    if docker-compose ps -q 2>/dev/null | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# 获取系统信息
get_system_info() {
    echo "=== 系统信息 ==="
    echo -e "${CYAN}主机名称:${NC} $(hostname)"
    echo -e "${CYAN}操作系统:${NC} $(uname -s -r)"
    echo -e "${CYAN}系统时间:${NC} $(date)"
    echo -e "${CYAN}运行时间:${NC} $(uptime | awk '{print $3, $4}' | sed 's/,//')"
    echo ""
}

# 获取Docker状态
get_docker_status() {
    echo "=== Docker 状态 ==="
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker 未安装${NC}"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}Docker 服务未运行${NC}"
        return 1
    fi
    
    local docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
    echo -e "${CYAN}Docker 版本:${NC} $docker_version"
    
    # 显示Docker系统信息
    local docker_info=$(docker system df --format "table {{.Type}}\t{{.Total}}\t{{.Active}}\t{{.Size}}" 2>/dev/null)
    if [ -n "$docker_info" ]; then
        echo -e "${CYAN}Docker 存储使用:${NC}"
        echo "$docker_info"
    fi
    
    echo ""
}

# 获取服务状态
get_service_status() {
    echo "=== 服务状态 ==="
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Docker Compose 未安装${NC}"
        return 1
    fi
    
    local compose_file="docker-compose.yml"
    if [ ! -f "$compose_file" ]; then
        echo -e "${RED}未找到 Docker Compose 配置文件${NC}"
        return 1
    fi
    
    # 获取服务状态
    local services=$(docker-compose ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}" 2>/dev/null)
    if [ -n "$services" ]; then
        echo "$services"
    else
        echo -e "${YELLOW}未检测到运行中的服务${NC}"
    fi
    
    echo ""
}

# 获取资源使用情况
get_resource_usage() {
    echo "=== 资源使用情况 ==="
    
    # CPU使用率
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    echo -e "${CYAN}CPU 使用率:${NC} ${cpu_usage}%"
    
    # 内存使用情况
    local memory_info=$(free -h | grep "Mem:")
    local memory_total=$(echo $memory_info | awk '{print $2}')
    local memory_used=$(echo $memory_info | awk '{print $3}')
    local memory_percent=$(echo $memory_info | awk '{printf "%.1f", ($3/$2)*100}')
    echo -e "${CYAN}内存使用:${NC} ${memory_used}/${memory_total} (${memory_percent}%)"
    
    # 磁盘使用情况
    echo -e "${CYAN}磁盘使用:${NC}"
    df -h | grep -E "(/$|/var|/tmp)" | while read line; do
        echo "  $line"
    done
    
    # 网络连接数
    local connections=$(netstat -an | grep ESTABLISHED | wc -l)
    echo -e "${CYAN}网络连接:${NC} ${connections} 个活跃连接"
    
    echo ""
}

# 获取容器资源使用
get_container_resources() {
    echo "=== 容器资源使用 ==="
    
    local container_ids=$(docker-compose ps -q 2>/dev/null)
    if [ -z "$container_ids" ]; then
        echo -e "${YELLOW}未检测到运行中的容器${NC}"
        return
    fi
    
    # 显示容器资源使用情况
    echo "容器名称             CPU %    内存使用 / 限制      内存 %    网络 I/O"
    echo "----------------------------------------------------------------"
    
    for container_id in $container_ids; do
        local stats=$(docker stats $container_id --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}" | tail -n +2)
        echo "$stats"
    done
    
    echo ""
}

# 获取应用健康状态
get_health_status() {
    echo "=== 应用健康状态 ==="
    
    # 检查前端健康状态
    local frontend_status="未知"
    if curl -f -s http://localhost/health &> /dev/null; then
        frontend_status="${GREEN}正常${NC}"
    else
        frontend_status="${RED}异常${NC}"
    fi
    echo -e "${CYAN}前端服务:${NC} $frontend_status"
    
    # 检查后端健康状态
    local backend_status="未知"
    if curl -f -s http://localhost:3001/api/health &> /dev/null; then
        backend_status="${GREEN}正常${NC}"
    else
        backend_status="${RED}异常${NC}"
    fi
    echo -e "${CYAN}后端服务:${NC} $backend_status"
    
    # 检查数据库状态
    local db_status="未知"
    local backend_container=$(docker-compose ps -q backend 2>/dev/null)
    if [ -n "$backend_container" ]; then
        if docker exec $backend_container test -f /app/database/fshare.db &> /dev/null; then
            db_status="${GREEN}正常${NC}"
        else
            db_status="${RED}异常${NC}"
        fi
    fi
    echo -e "${CYAN}数据库:${NC} $db_status"
    
    echo ""
}

# 获取日志摘要
get_log_summary() {
    echo "=== 最近日志 ==="
    
    local backend_container=$(docker-compose ps -q backend 2>/dev/null)
    if [ -n "$backend_container" ]; then
        echo -e "${CYAN}后端服务日志 (最近10条):${NC}"
        docker logs $backend_container --tail 10 2>/dev/null | tail -10
        echo ""
    fi
    
    local frontend_container=$(docker-compose ps -q frontend 2>/dev/null)
    if [ -n "$frontend_container" ]; then
        echo -e "${CYAN}前端服务日志 (最近5条):${NC}"
        docker logs $frontend_container --tail 5 2>/dev/null | tail -5
        echo ""
    fi
}

# 获取详细信息
get_detailed_info() {
    if [ "$DETAIL" = false ]; then
        return
    fi
    
    echo "=== 详细信息 ==="
    
    # 显示端口使用情况
    echo -e "${CYAN}端口使用情况:${NC}"
    netstat -tulpn | grep -E ":80|:3001|:5173" 2>/dev/null || echo "  未检测到相关端口占用"
    echo ""
    
    # 显示Docker卷信息
    local volumes=$(docker volume ls -f "name=${PROJECT_NAME}" --format "{{.Name}}" 2>/dev/null)
    if [ -n "$volumes" ]; then
        echo -e "${CYAN}Docker 数据卷:${NC}"
        for volume in $volumes; do
            local size=$(docker run --rm -v $volume:/data alpine du -sh /data 2>/dev/null | cut -f1 || echo "未知")
            echo "  $volume: $size"
        done
        echo ""
    fi
    
    # 显示最近的容器事件
    echo -e "${CYAN}最近容器事件:${NC}"
    docker events --since="1h" --until="now" --filter "container=$(docker-compose ps -q | tr '\n' '|' | sed 's/|$//')" --format "{{.Time}} {{.Status}} {{.ID}}" 2>/dev/null | tail -5 || echo "  无最近事件"
    echo ""
}

# JSON格式输出
output_json() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # 获取服务状态
    local services_status="{}"
    local container_ids=$(docker-compose ps -q 2>/dev/null)
    if [ -n "$container_ids" ]; then
        for container_id in $container_ids; do
            local name=$(docker inspect $container_id --format '{{.Name}}' | sed 's/^//')
            local status=$(docker inspect $container_id --format '{{.State.Status}}')
            services_status=$(echo $services_status | jq --arg name "$name" --arg status "$status" '. + {($name): $status}')
        done
    fi
    
    # 构建JSON输出
    cat << EOF
{
  "timestamp": "$timestamp",
  "system": {
    "hostname": "$(hostname)",
    "uptime": "$(uptime | awk '{print $3, $4}' | sed 's/,//')",
    "load_average": "$(uptime | awk -F'load average:' '{print $2}' | xargs)"
  },
  "resources": {
    "cpu_usage": "$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%",
    "memory": {
      "total": "$(free -h | grep "Mem:" | awk '{print $2}')",
      "used": "$(free -h | grep "Mem:" | awk '{print $3}')",
      "percentage": "$(free | grep "Mem:" | awk '{printf "%.1f", ($3/$2)*100}')%"
    },
    "disk_usage": "$(df -h / | tail -1 | awk '{print $5}')"
  },
  "services": $services_status,
  "health": {
    "frontend": "$(curl -f -s http://localhost/health &> /dev/null && echo "healthy" || echo "unhealthy")",
    "backend": "$(curl -f -s http://localhost:3001/api/health &> /dev/null && echo "healthy" || echo "unhealthy")"
  }
}
EOF
}

# 清屏
clear_screen() {
    if [ "$CONTINUOUS" = true ]; then
        clear
    fi
}

# 显示监控信息
show_monitoring() {
    if [ "$JSON_OUTPUT" = true ]; then
        output_json
        return
    fi
    
    clear_screen
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Quick FShare 系统监控面板${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    get_system_info
    get_docker_status
    get_service_status
    get_resource_usage
    get_container_resources
    get_health_status
    get_detailed_info
    
    if [ "$CONTINUOUS" = true ]; then
        get_log_summary
        echo -e "${BLUE}========================================${NC}"
        echo -e "${CYAN}按 Ctrl+C 退出监控${NC}"
        echo -e "${CYAN}刷新间隔: ${REFRESH_INTERVAL} 秒${NC}"
        echo -e "${BLUE}========================================${NC}"
    fi
}

# 主函数
main() {
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --continuous|-c)
                CONTINUOUS=true
                shift
                ;;
            --json|-j)
                JSON_OUTPUT=true
                shift
                ;;
            --detail|-d)
                DETAIL=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 检查依赖
    if ! command -v jq &> /dev/null && [ "$JSON_OUTPUT" = true ]; then
        echo "错误: JSON输出需要安装 jq"
        exit 1
    fi
    
    # 执行监控
    if [ "$CONTINUOUS" = true ] && [ "$JSON_OUTPUT" = false ]; then
        # 持续监控模式
        while true; do
            show_monitoring
            sleep $REFRESH_INTERVAL
        done
    else
        # 单次显示
        show_monitoring
    fi
}

# 捕获Ctrl+C信号
trap 'echo -e "\n${GREEN}监控已停止${NC}"; exit 0' INT

# 执行主函数
main "$@" 