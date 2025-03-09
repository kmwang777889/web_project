import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Input, 
  Select, 
  Modal, 
  Form, 
  DatePicker, 
  message, 
  Popconfirm, 
  Tag, 
  Space,
  Tabs 
} from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  DownloadOutlined,
  ProjectOutlined,
  UnorderedListOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import PendingSchedule from './PendingSchedule';
import WorkItemList from './WorkItemList';

const { Option } = Select;
const { RangePicker } = DatePicker;

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从URL参数中获取tab值
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'projects');
  
  // 当URL参数变化时更新activeTab
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  // 当切换标签页时更新URL参数
  const handleTabChange = (key) => {
    setActiveTab(key);
    navigate(`/projects${key !== 'projects' ? `?tab=${key}` : ''}`);
  };
  
  // 筛选条件
  const [filters, setFilters] = useState({
    search: '',
    status: ''
  });
  
  // 获取项目列表
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects(filters);
      // 确保data是一个数组，如果不是则使用空数组
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取项目列表失败:', error);
      message.error('获取项目列表失败');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchProjects();
  }, []);
  
  // 当筛选条件变化时重新获取数据
  useEffect(() => {
    fetchProjects();
  }, [filters]);
  
  // 处理筛选条件变化
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 打开创建/编辑项目模态框
  const showModal = (project = null) => {
    setEditingProject(project);
    form.resetFields();
    
    if (project) {
      form.setFieldsValue({
        ...project,
        startDate: project.startDate ? dayjs(project.startDate) : null,
        endDate: project.endDate ? dayjs(project.endDate) : null
      });
    }
    
    setModalVisible(true);
  };
  
  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
    setEditingProject(null);
    form.resetFields();
  };
  
  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingProject) {
        // 更新项目
        await api.updateProject(editingProject.id, values);
        message.success('项目更新成功');
      } else {
        // 创建项目
        await api.createProject(values);
        message.success('项目创建成功');
      }
      
      setModalVisible(false);
      fetchProjects();
    } catch (error) {
      console.error('保存项目失败:', error);
      message.error('保存项目失败: ' + error.message);
    }
  };
  
  // 删除项目
  const handleDelete = async (id) => {
    try {
      await api.deleteProject(id);
      message.success('项目删除成功');
      fetchProjects();
    } catch (error) {
      console.error('删除项目失败:', error);
      message.error('删除项目失败: ' + error.message);
    }
  };
  
  // 导出项目
  const handleExport = async (id) => {
    try {
      const response = await api.exportProject(id);
      message.info(response.message);
    } catch (error) {
      console.error('导出项目失败:', error);
      message.error('导出项目失败: ' + error.message);
    }
  };
  
  // 渲染状态标签
  const renderStatusTag = (status) => {
    let className = '';
    switch (status) {
      case '待处理':
        className = 'status-pending';
        break;
      case '进行中':
        className = 'status-in-progress';
        break;
      case '已完成':
        className = 'status-completed';
        break;
      case '关闭':
        className = 'status-closed';
        break;
      default:
        className = 'status-pending';
    }
    return <Tag className={`status-tag ${className}`}>{status}</Tag>;
  };
  
  // 表格列定义
  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Link to={`/projects/${record.id}`}>{text}</Link>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: renderStatusTag
    },
    {
      title: '创建者',
      dataIndex: 'creator',
      key: 'creator',
      render: (creator) => creator ? creator.username : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EyeOutlined />} 
            size="small"
            onClick={() => navigate(`/projects/${record.id}`)}
          />
          {isAdmin() && (
            <>
              <Button 
                icon={<EditOutlined />} 
                size="small"
                onClick={() => showModal(record)}
              />
              <Popconfirm
                title="确定要删除此项目吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  icon={<DeleteOutlined />} 
                  size="small"
                  danger
                />
              </Popconfirm>
              <Button 
                icon={<DownloadOutlined />} 
                size="small"
                onClick={() => handleExport(record.id)}
              />
            </>
          )}
        </Space>
      )
    }
  ];
  
  return (
    <div className="project-management">      
      <Card 
        bordered={false}
        bodyStyle={{ 
          padding: 0,
          backgroundColor: '#fff'
        }}
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={handleTabChange}
          type="card"
          size="large"
          tabBarStyle={{
            marginBottom: 0,
            paddingLeft: 20,
            paddingRight: 20,
            borderBottom: '1px solid #f0f0f0',
            backgroundColor: '#fafafa'
          }}
          tabBarGutter={8}
          items={[
            {
              key: 'projects',
              label: (
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '8px 4px',
                  fontSize: '15px'
                }}>
                  <ProjectOutlined style={{ marginRight: 8, fontSize: '18px' }} />
                  项目列表
                </span>
              ),
              children: (
                <div style={{ padding: '20px' }}>
                  {/* 筛选器和操作按钮 */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: 16,
                    padding: '16px 20px',
                    background: '#fafafa',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0'
                  }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <Input
                        placeholder="搜索项目名称"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        style={{ width: 200 }}
                        prefix={<SearchOutlined />}
                        allowClear
                      />
                      <Select
                        placeholder="状态"
                        style={{ width: 120 }}
                        value={filters.status || undefined}
                        onChange={(value) => handleFilterChange('status', value)}
                        allowClear
                      >
                        <Option value="待处理">待处理</Option>
                        <Option value="进行中">进行中</Option>
                        <Option value="已完成">已完成</Option>
                        <Option value="关闭">关闭</Option>
                      </Select>
                    </div>
                    
                    {isAdmin() && (
                      <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                      >
                        创建项目
                      </Button>
                    )}
                  </div>
                  
                  {/* 项目列表 */}
                  <Table
                    columns={columns}
                    dataSource={projects}
                    rowKey="id"
                    loading={loading}
                    pagination={{ 
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: total => `共 ${total} 条`
                    }}
                    style={{ marginTop: 8 }}
                  />
                </div>
              )
            },
            {
              key: 'workItems',
              label: (
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '8px 4px',
                  fontSize: '15px'
                }}>
                  <UnorderedListOutlined style={{ marginRight: 8, fontSize: '18px' }} />
                  工作项列表
                </span>
              ),
              children: <div style={{ padding: '20px' }}><WorkItemList /></div>
            },
            ...(isAdmin() ? [{
              key: 'pendingItems',
              label: (
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '8px 4px',
                  fontSize: '15px'
                }}>
                  <ClockCircleOutlined style={{ marginRight: 8, fontSize: '18px' }} />
                  待排期工作项
                </span>
              ),
              children: <div style={{ padding: '20px' }}><PendingSchedule /></div>
            }] : [])
          ]}
        />
      </Card>
      
      {/* 创建/编辑项目模态框 */}
      <Modal
        title={editingProject ? '编辑项目' : '创建项目'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText="保存"
        cancelText="取消"
        width={600}
        maskClosable={false}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="项目描述"
          >
            <Input.TextArea rows={4} placeholder="请输入项目描述" />
          </Form.Item>
          
          <Form.Item
            name="startDate"
            label="开始日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="endDate"
            label="结束日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="状态"
            initialValue="待处理"
          >
            <Select>
              <Option value="待处理">待处理</Option>
              <Option value="进行中">进行中</Option>
              <Option value="已完成">已完成</Option>
              <Option value="关闭">关闭</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectList; 