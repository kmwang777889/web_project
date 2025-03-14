import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Form, 
  DatePicker, 
  Input, 
  message, 
  Spin,
  Typography,
  Select
} from 'antd';
import { 
  CalendarOutlined, 
  EditOutlined, 
  EyeOutlined,
  SearchOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import { renderPriorityTag, renderStatusTag, renderTypeTag } from '../utils/tagRenderers';

const { Title } = Typography;
const { Option } = Select;

const PendingSchedule = () => {
  const [pendingItems, setPendingItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  
  // 筛选条件状态
  const [filters, setFilters] = useState({
    title: '',
    type: '',
    priority: '',
  });
  
  // 获取待排期工作项
  const fetchPendingItems = async () => {
    try {
      setLoading(true);
      const data = await api.getPendingScheduleItems();
      setPendingItems(data);
      setFilteredItems(data);
    } catch (error) {
      console.error('获取待排期工作项失败:', error);
      message.error('获取待排期工作项失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchPendingItems();
  }, []);
  
  // 处理筛选条件变化
  const handleFilterChange = (name, value) => {
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };
  
  // 重置筛选条件
  const resetFilters = () => {
    setFilters({
      title: '',
      type: '',
      priority: '',
    });
    setFilteredItems(pendingItems);
  };
  
  // 应用筛选条件
  const applyFilters = (currentFilters) => {
    let result = [...pendingItems];
    
    if (currentFilters.title) {
      result = result.filter(item => 
        item.title.toLowerCase().includes(currentFilters.title.toLowerCase())
      );
    }
    
    if (currentFilters.type) {
      result = result.filter(item => item.type === currentFilters.type);
    }
    
    if (currentFilters.priority) {
      result = result.filter(item => item.priority === currentFilters.priority);
    }
    
    setFilteredItems(result);
  };
  
  // 打开排期模态框
  const showScheduleModal = (item) => {
    setCurrentItem(item);
    form.resetFields();
    
    // 设置初始值
    form.setFieldsValue({
      estimatedHours: item.estimatedHours,
      scheduledStartDate: item.scheduledStartDate ? dayjs(item.scheduledStartDate) : null,
      scheduledEndDate: item.scheduledEndDate ? dayjs(item.scheduledEndDate) : null
    });
    
    setScheduleModalVisible(true);
  };
  
  // 关闭模态框
  const handleCancel = () => {
    setScheduleModalVisible(false);
    setCurrentItem(null);
  };
  
  // 提交排期表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!currentItem) {
        return;
      }
      
      // 转换日期对象为ISO字符串格式
      if (values.scheduledStartDate) {
        values.scheduledStartDate = values.scheduledStartDate.format('YYYY-MM-DD');
      }
      
      if (values.scheduledEndDate) {
        values.scheduledEndDate = values.scheduledEndDate.format('YYYY-MM-DD');
      }
      
      await api.updateWorkItem(currentItem.id, values);
      message.success('工作项排期更新成功');
      
      setScheduleModalVisible(false);
      fetchPendingItems();
    } catch (error) {
      console.error('更新排期失败:', error);
      message.error('更新排期失败: ' + error.message);
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Link to={`/work-items/${record.id}`}>{text}</Link>
      )
    },
    {
      title: '项目',
      dataIndex: 'Project',
      key: 'project',
      render: (project) => project ? (
        <Link to={`/projects/${project.id}`}>{project.name}</Link>
      ) : '-'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: renderTypeTag
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderStatusTag
    },
    {
      title: '紧急程度',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: renderPriorityTag
    },
    {
      title: '创建者',
      dataIndex: 'creator',
      key: 'creator',
      width: 120,
      render: (creator) => creator ? creator.username : '-'
    },
    {
      title: '创建日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: '期望完成日期',
      dataIndex: 'expectedCompletionDate',
      key: 'expectedCompletionDate',
      width: 120,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EyeOutlined />} 
            size="small"
            onClick={() => navigate(`/work-items/${record.id}`)}
          />
          <Button 
            icon={<CalendarOutlined />} 
            size="small"
            type="primary"
            onClick={() => showScheduleModal(record)}
          />
          <Button 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => navigate(`/work-items/${record.id}`)}
          />
        </Space>
      )
    }
  ];
  
  return (
    <div>
      {/* 筛选器 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            alignItems: 'center', 
            flexWrap: 'wrap',
            flex: 1
          }}>
            <Input
              placeholder="搜索标题"
              value={filters.title}
              onChange={(e) => handleFilterChange('title', e.target.value)}
              style={{ width: 400 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Select
              placeholder="类型"
              style={{ width: 150 }}
              value={filters.type || undefined}
              onChange={(value) => handleFilterChange('type', value)}
              allowClear
            >
              <Option value="规划">规划</Option>
              <Option value="需求">需求</Option>
              <Option value="事务">事务</Option>
              <Option value="缺陷">缺陷</Option>
            </Select>
            <Select
              placeholder="紧急程度"
              style={{ width: 150 }}
              value={filters.priority || undefined}
              onChange={(value) => handleFilterChange('priority', value)}
              allowClear
            >
              <Option value="紧急">紧急</Option>
              <Option value="高">高</Option>
              <Option value="中">中</Option>
              <Option value="低">低</Option>
            </Select>
            <Button 
              icon={<FilterOutlined />} 
              onClick={resetFilters}
            >
              重置筛选
            </Button>
          </div>
        </div>
      </Card>
      
      <Card>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={filteredItems}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1200 }}
          />
        </Spin>
      </Card>
      
      {/* 排期模态框 */}
      <Modal
        title="工作排期"
        open={scheduleModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          {currentItem && (
            <div style={{ marginBottom: 16 }}>
              <div><strong>标题:</strong> {currentItem.title}</div>
              <div><strong>类型:</strong> {currentItem.type}</div>
              <div><strong>优先级:</strong> {currentItem.priority}</div>
              {currentItem.expectedCompletionDate && (
                <div>
                  <strong>期望完成日期:</strong> {new Date(currentItem.expectedCompletionDate).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
          
          <Form.Item
            name="estimatedHours"
            label="预估工时(小时)"
            rules={[{ required: true, message: '请输入预估工时' }]}
          >
            <Input type="number" min={0} step={0.5} />
          </Form.Item>
          
          <Form.Item
            name="scheduledStartDate"
            label="排期开始日期"
            rules={[{ required: true, message: '请选择排期开始日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="scheduledEndDate"
            label="排期结束日期"
            dependencies={['scheduledStartDate']}
            validateTrigger={['onChange', 'onBlur']}
            rules={[
              { required: true, message: '请选择排期结束日期' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const startDate = getFieldValue('scheduledStartDate');
                  if (!value || !startDate || value.isAfter(startDate) || value.isSame(startDate)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('结束日期必须晚于或等于开始日期'));
                },
              })
            ]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PendingSchedule; 