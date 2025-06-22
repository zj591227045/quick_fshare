import React from 'react'
import { Card, Radio, TimePicker, Space, Switch, ColorPicker, Button, Divider, Typography } from 'antd'
import { MoonOutlined, SunOutlined, ClockCircleOutlined, BgColorsOutlined } from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const ThemeSettings: React.FC = () => {
  const { 
    mode, 
    actualMode, 
    primaryColor, 
    autoSwitchTime, 
    reducedMotion,
    setMode, 
    setPrimaryColor, 
    setAutoSwitchTime,
    setReducedMotion,
    resetTheme 
  } = useTheme()

  const handleAutoTimeChange = (type: 'light' | 'dark', time: dayjs.Dayjs | null) => {
    if (time) {
      setAutoSwitchTime({
        ...autoSwitchTime,
        [type]: time.format('HH:mm')
      })
    }
  }

  const presetColors = [
    '#1890ff', // 默认蓝色
    '#52c41a', // 绿色
    '#faad14', // 橙色
    '#f5222d', // 红色
    '#722ed1', // 紫色
    '#13c2c2', // 青色
    '#eb2f96', // 粉色
    '#fa8c16', // 金色
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title={
        <Space>
          <BgColorsOutlined />
          <span>主题设置</span>
        </Space>
      }>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 主题模式选择 */}
          <div>
            <Title level={5}>主题模式</Title>
            <Radio.Group 
              value={mode} 
              onChange={(e) => setMode(e.target.value)}
              size="large"
            >
              <Radio.Button value="light">
                <Space>
                  <SunOutlined />
                  浅色模式
                </Space>
              </Radio.Button>
              <Radio.Button value="dark">
                <Space>
                  <MoonOutlined />
                  深色模式
                </Space>
              </Radio.Button>
              <Radio.Button value="auto">
                <Space>
                  <ClockCircleOutlined />
                  自动切换
                </Space>
              </Radio.Button>
            </Radio.Group>
            {mode !== 'auto' && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  当前显示: {actualMode === 'light' ? '浅色' : '深色'}模式
                </Text>
              </div>
            )}
          </div>

          {/* 自动切换时间设置 */}
          {mode === 'auto' && (
            <div>
              <Title level={5}>自动切换时间</Title>
              <Space>
                <div>
                  <Text>浅色模式开始时间:</Text>
                  <br />
                  <TimePicker
                    value={dayjs(autoSwitchTime.light, 'HH:mm')}
                    format="HH:mm"
                    onChange={(time) => handleAutoTimeChange('light', time)}
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div>
                  <Text>深色模式开始时间:</Text>
                  <br />
                  <TimePicker
                    value={dayjs(autoSwitchTime.dark, 'HH:mm')}
                    format="HH:mm"
                    onChange={(time) => handleAutoTimeChange('dark', time)}
                    style={{ marginTop: 4 }}
                  />
                </div>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  当前模式: {actualMode === 'light' ? '浅色' : '深色'} 
                  (基于时间 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })})
                </Text>
              </div>
            </div>
          )}

          <Divider />

          {/* 主色调设置 */}
          <div>
            <Title level={5}>主色调</Title>
            <Space wrap>
              <ColorPicker
                value={primaryColor}
                onChange={(color) => setPrimaryColor(color.toHexString())}
                showText
                size="large"
                presets={[
                  {
                    label: '推荐颜色',
                    colors: presetColors,
                  },
                ]}
              />
              <Button 
                onClick={() => setPrimaryColor('#1890ff')}
                disabled={primaryColor === '#1890ff'}
              >
                恢复默认
              </Button>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                选择您喜欢的主色调，将应用于按钮、链接等元素
              </Text>
            </div>
          </div>

          <Divider />

          {/* 动画设置 */}
          <div>
            <Title level={5}>动画效果</Title>
            <Space>
              <Switch
                checked={!reducedMotion}
                onChange={(checked) => setReducedMotion(!checked)}
              />
              <Text>启用过渡动画</Text>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                关闭动画可以提高性能，适合配置较低的设备
              </Text>
            </div>
          </div>

          <Divider />

          {/* 重置按钮 */}
          <div>
            <Button danger onClick={resetTheme}>
              重置所有主题设置
            </Button>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                将恢复所有主题设置到默认状态
              </Text>
            </div>
          </div>
        </Space>
      </Card>

      {/* 主题预览 */}
      <Card title="预览效果" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ 
            padding: '16px', 
            background: 'var(--bg-secondary)', 
            borderRadius: '6px',
            border: '1px solid var(--border-secondary)'
          }}>
            <Text style={{ color: 'var(--text-primary)' }}>主要文字颜色</Text>
            <br />
            <Text style={{ color: 'var(--text-secondary)' }}>次要文字颜色</Text>
            <br />
            <Text style={{ color: 'var(--text-tertiary)' }}>第三级文字颜色</Text>
          </div>
          <Space>
            <Button type="primary">主要按钮</Button>
            <Button>默认按钮</Button>
            <Button type="dashed">虚线按钮</Button>
            <Button type="link">链接按钮</Button>
          </Space>
        </Space>
      </Card>
    </Space>
  )
}

export default ThemeSettings 