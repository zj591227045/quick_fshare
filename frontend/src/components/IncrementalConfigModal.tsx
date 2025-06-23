import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Switch, 
  InputNumber, 
  Slider, 
  Space, 
  Alert, 
  App,
  Divider,
  Spin
} from 'antd';
import { 
  SettingOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { browseApi } from '@/services/api';

interface IncrementalConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const IncrementalConfigModal: React.FC<IncrementalConfigModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 加载当前配置
  const loadCurrentConfig = async () => {
    setLoading(true);
    try {
      const response = await browseApi.getIncrementalConfig();
      if (response.success) {
        const config = response.data;
        form.setFieldsValue({
          enabled: config.enabled,
          checkIntervalMinutes: config.checkInterval / 1000 / 60,
          fullRebuildThresholdPercent: config.fullRebuildThreshold * 100
        });
      } else {
        // 使用默认值
        const defaultConfig = {
          enabled: true,
          checkIntervalMinutes: 2,
          fullRebuildThresholdPercent: 30
        };
        form.setFieldsValue(defaultConfig);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      // 使用默认值
      const defaultConfig = {
        enabled: true,
        checkIntervalMinutes: 2,
        fullRebuildThresholdPercent: 30
      };
      form.setFieldsValue(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const handleSave = async (values: any) => {
    setSubmitting(true);
    try {
      const config = {
        enabled: values.enabled,
        checkInterval: values.checkIntervalMinutes * 60 * 1000, // 转换为毫秒
        fullRebuildThreshold: values.fullRebuildThresholdPercent / 100 // 转换为小数
      };

      const response = await browseApi.configureIncrementalUpdate(config);
      if (response.success) {
        message.success('增量更新配置已保存');
        onSuccess?.();
        onClose();
      } else {
        message.error(response.message || '保存配置失败');
      }
    } catch (error) {
      message.error('保存配置失败');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadCurrentConfig();
    }
  }, [visible]);

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          增量更新配置
        </Space>
      }
      open={visible}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={600}
      okText="保存配置"
      cancelText="取消"
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>加载配置中...</div>
        </div>
      )}
      {!loading && (
        <>
          <Alert
            message="增量更新说明"
            description="增量更新可以自动检测文件变更并更新搜索索引，减少全量重建的频率。启用后系统会定期扫描文件变化，当变更超过阈值时会触发全量重建。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          enabled: true,
          checkIntervalMinutes: 2,
          fullRebuildThresholdPercent: 30
        }}
      >
        <Form.Item
          name="enabled"
          label="启用增量更新"
          valuePropName="checked"
        >
          <Switch
            checkedChildren="启用"
            unCheckedChildren="禁用"
            style={{ marginBottom: 8 }}
          />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.enabled !== currentValues.enabled}
        >
          {({ getFieldValue }) => {
            const enabled = getFieldValue('enabled');
            
            return enabled ? (
              <>
                <Divider />
                
                <Form.Item
                  name="checkIntervalMinutes"
                  label={
                    <Space>
                      <ClockCircleOutlined />
                      检查间隔（分钟）
                    </Space>
                  }
                  help="设置系统检查文件变更的时间间隔，建议不少于1分钟"
                >
                  <div>
                    <Slider
                      min={1}
                      max={60}
                      step={1}
                      marks={{
                        1: '1分钟',
                        5: '5分钟',
                        10: '10分钟',
                        30: '30分钟',
                        60: '1小时'
                      }}
                      style={{ marginBottom: 16 }}
                    />
                    <InputNumber
                      min={1}
                      max={60}
                      step={1}
                      addonAfter="分钟"
                      style={{ width: '120px' }}
                    />
                  </div>
                </Form.Item>

                <Form.Item
                  name="fullRebuildThresholdPercent"
                  label={
                    <Space>
                      <ThunderboltOutlined />
                      全量重建阈值（%）
                    </Space>
                  }
                  help="当变更文件数量占总文件数的比例超过此阈值时，会触发全量重建而非增量更新"
                >
                  <div>
                    <Slider
                      min={10}
                      max={80}
                      step={5}
                      marks={{
                        10: '10%',
                        20: '20%',
                        30: '30%',
                        50: '50%',
                        80: '80%'
                      }}
                      style={{ marginBottom: 16 }}
                    />
                    <InputNumber
                      min={10}
                      max={80}
                      step={5}
                      addonAfter="%"
                      style={{ width: '120px' }}
                    />
                  </div>
                </Form.Item>

                <Alert
                  message="性能建议"
                  description={
                    <div>
                      <div>• 检查间隔过短可能会影响系统性能，建议根据文件变更频率设置</div>
                      <div>• 全量重建阈值过低会导致频繁的全量重建，建议设置在20-40%之间</div>
                      <div>• 对于大型共享目录，建议适当增加检查间隔</div>
                    </div>
                  }
                  type="warning"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </>
            ) : (
              <Alert
                message="增量更新已禁用"
                description="禁用增量更新后，索引只能通过手动重建来更新。这适用于静态文件共享或不希望系统自动扫描的场景。"
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            );
                     }}
         </Form.Item>
       </Form>
        </>
      )}
    </Modal>
  );
};

export default IncrementalConfigModal; 