import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Descriptions, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  message, 
  Popconfirm,
  Spin,
  Tabs
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  PlusOutlined, 
  EyeOutlined,
  DownloadOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const { Option } = Select;
const { TabPane } = Tabs;

// 优先级标签渲染
const renderPriorityTag = (priority) => {
  let color = '';
  switch (priority) {
    case '紧急':
      color = 'priority-urgent';
      break;
    case '高':
      color = 'priority-high';
      break;
    case '中':
      color = 'priority-medium';
      break;
    case '低':
      color = 'priority-low';
      break;
    default:
      color = 'priority-medium';
  }
  return <Tag className={`priority-tag ${color}`}>{priority}</Tag>;
};

// 状态标签渲染
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

// 类型标签渲染
const renderTypeTag = (type) => {
  let className = '';
  switch (type) {
    case '规划':
      className = 'type-planning';
      break;
    case '需求':
      className = 'type-requirement';
      break;
    case '事务':
      className = 'type-task';
      break;
    case '缺陷':
      className = 'type-bug';
      break;
    default:
      className = 'type-task';
  }
  return <Tag className={`type-tag ${className}`}>{type}</Tag>;
};

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [workItemModalVisible, setWorkItemModalVisible] = useState(false);
  const [editingWorkItem, setEditingWorkItem] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [projectForm] = Form.useForm();
  const [workItemForm] = Form.useForm();
  
  // 获取项目详情
  const fetchProject = async () => {
    try {
      setLoading(true);
      const data = await api.getProjectById(id);
      setProject(data);
    } catch (error) {
      console.error('获取项目详情失败:', error);
      message.error('获取项目详情失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取管理员列表
  const fetchAdmins = async () => {
    try {
      const data = await api.getAdmins();
      setAdmins(data);
    } catch (error) {
      console.error('获取管理员列表失败:', error);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchProject();
    fetchAdmins();
  }, [id]);
  
  // 打开编辑项目模态框
  const showEditProjectModal = () => {
    projectForm.resetFields();
    
    if (project) {
      projectForm.setFieldsValue({
        ...project,
        startDate: project.startDate ? dayjs(project.startDate) : null,
        endDate: project.endDate ? dayjs(project.endDate) : null
      });
    }
    
    setEditModalVisible(true);
  };
  
  // 关闭编辑项目模态框
  const handleEditProjectCancel = () => {
    setEditModalVisible(false);
  };
  
  // 提交编辑项目表单
  const handleEditProjectSubmit = async () => {
    try {
      const values = await projectForm.validateFields();
      
      await api.updateProject(id, values);
      message.success('项目更新成功');
      
      setEditModalVisible(false);
      fetchProject();
    } catch (error) {
      console.error('更新项目失败:', error);
      message.error('更新项目失败: ' + error.message);
    }
  };
  
  // 打开创建/编辑工作项模态框
  const showWorkItemModal = (workItem = null) => {
    setEditingWorkItem(workItem);
    workItemForm.resetFields();
    
    if (workItem) {
      workItemForm.setFieldsValue({
        ...workItem,
        expectedCompletionDate: workItem.expectedCompletionDate ? dayjs(workItem.expectedCompletionDate) : null,
        scheduledStartDate: workItem.scheduledStartDate ? dayjs(workItem.scheduledStartDate) : null,
        scheduledEndDate: workItem.scheduledEndDate ? dayjs(workItem.scheduledEndDate) : null
      });
    } else {
      // 新建工作项默认关联当前项目
      workItemForm.setFieldsValue({
        projectId: parseInt(id)
      });
    }
    
    setWorkItemModalVisible(true);
  };
  
  // 关闭工作项模态框
  const handleWorkItemCancel = () => {
    setWorkItemModalVisible(false);
    setEditingWorkItem(null);
  };
  
  // 提交工作项表单
  const handleWorkItemSubmit = async () => {
    try {
      const values = await workItemForm.validateFields();
      
      if (editingWorkItem) {
        // 更新工作项
        await api.updateWorkItem(editingWorkItem.id, values);
        message.success('工作项更新成功');
      } else {
        // 创建工作项
        await api.createWorkItem(values);
        message.success('工作项创建成功');
      }
      
      setWorkItemModalVisible(false);
      fetchProject();
    } catch (error) {
      console.error('保存工作项失败:', error);
      message.error('保存工作项失败: ' + error.message);
    }
  };
  
  // 删除工作项
  const handleDeleteWorkItem = async (workItemId) => {
    try {
      await api.deleteWorkItem(workItemId);
      message.success('工作项删除成功');
      fetchProject();
    } catch (error) {
      console.error('删除工作项失败:', error);
      message.error('删除工作项失败: ' + error.message);
    }
  };
  
  // 导出项目
  const handleExport = async () => {
    try {
      const response = await api.exportProject(id);
      message.info(response.message);
    } catch (error) {
      console.error('导出项目失败:', error);
      message.error('导出项目失败: ' + error.message);
    }
  };
  
  // 工作项表格列定义
  const workItemColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
      render: (text, record) => (
        <Link to={`/work-items/${record.id}`}>{text}</Link>
      )
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
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 120,
      render: (assignee) => assignee ? assignee.username : '未分配'
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
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => {
        const canEdit = isAdmin() || (record.creator && record.creator.id === record.createdById);
        
        return (
          <Space size="small">
            <Button 
              icon={<EyeOutlined />} 
              size="small"
              onClick={() => navigate(`/work-items/${record.id}`)}
            />
            {canEdit && (
              <>
                <Button 
                  icon={<EditOutlined />} 
                  size="small"
                  onClick={() => showWorkItemModal(record)}
                />
                <Popconfirm
                  title="确定要删除此工作项吗？"
                  onConfirm={() => handleDeleteWorkItem(record.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button 
                    icon={<DeleteOutlined />} 
                    size="small"
                    danger
                  />
                </Popconfirm>
              </>
            )}
          </Space>
        );
      }
    }
  ];
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }
  
  if (!project) {
    return (
      <div>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/projects')}
          style={{ marginBottom: 16 }}
        >
          返回项目列表
        </Button>
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            项目不存在或已被删除
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/projects')}
        >
          返回项目列表
        </Button>
        
        <Space>
          {isAdmin() && (
            <Button 
              icon={<EditOutlined />} 
              onClick={showEditProjectModal}
            >
              编辑项目
            </Button>
          )}
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleExport}
          >
            导出项目
          </Button>
        </Space>
      </div>
      
      {/* 项目详情 */}
      <Card title={`项目详情: ${project.name}`} style={{ marginBottom: 24 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="项目名称">{project.name}</Descriptions.Item>
          <Descriptions.Item label="状态">{renderStatusTag(project.status)}</Descriptions.Item>
          <Descriptions.Item label="开始日期">
            {project.startDate ? new Date(project.startDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="结束日期">
            {project.endDate ? new Date(project.endDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建者">
            {project.creator ? project.creator.username : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(project.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {project.description || '无描述'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      
      {/* 工作项列表 */}
      <Card 
        title="工作项列表" 
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => showWorkItemModal()}
          >
            创建工作项
          </Button>
        }
      >
        <Tabs defaultActiveKey="all">
          <TabPane tab="全部" key="all">
            <Table
              columns={workItemColumns}
              dataSource={project.WorkItems || []}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="待处理" key="pending">
            <Table
              columns={workItemColumns}
              dataSource={(project.WorkItems || []).filter(item => item.status === '待处理')}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="进行中" key="inProgress">
            <Table
              columns={workItemColumns}
              dataSource={(project.WorkItems || []).filter(item => item.status === '进行中')}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="已完成" key="completed">
            <Table
              columns={workItemColumns}
              dataSource={(project.WorkItems || []).filter(item => item.status === '已完成')}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="已关闭" key="closed">
            <Table
              columns={workItemColumns}
              dataSource={(project.WorkItems || []).filter(item => item.status === '关闭')}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>
      
      {/* 编辑项目模态框 */}
      <Modal
        title="编辑项目"
        open={editModalVisible}
        onOk={handleEditProjectSubmit}
        onCancel={handleEditProjectCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={projectForm}
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
      
      {/* 创建/编辑工作项模态框 */}
      <Modal
        title={editingWorkItem ? '编辑工作项' : '创建工作项'}
        open={workItemModalVisible}
        onOk={handleWorkItemSubmit}
        onCancel={handleWorkItemCancel}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Form
          form={workItemForm}
          layout="vertical"
        >
          <Form.Item
            name="projectId"
            hidden
          >
            <Input type="hidden" />
          </Form.Item>
          
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题" />
          </Form.Item>
          
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
            initialValue="事务"
          >
            <Select>
              <Option value="规划">规划</Option>
              <Option value="需求">需求</Option>
              <Option value="事务">事务</Option>
              <Option value="缺陷">缺陷</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={4} placeholder="请输入描述" />
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
          
          <Form.Item
            name="priority"
            label="紧急程度"
            initialValue="中"
          >
            <Select>
              <Option value="紧急">紧急</Option>
              <Option value="高">高</Option>
              <Option value="中">中</Option>
              <Option value="低">低</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="source"
            label="需求来源"
          >
            <Select allowClear>
              <Option value="内部需求">内部需求</Option>
              <Option value="品牌需求">品牌需求</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="assigneeId"
            label="负责人"
          >
            <Select allowClear placeholder="请选择负责人">
              {admins.map(admin => (
                <Option key={admin.id} value={admin.id}>
                  {admin.username} ({admin.role === 'super_admin' ? '超级管理员' : '管理员'})
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="expectedCompletionDate"
            label="期望完成日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          {isAdmin() && (
            <>
              <Form.Item
                name="estimatedHours"
                label="预估工时(小时)"
              >
                <Input type="number" min={0} step={0.5} />
              </Form.Item>
              
              <Form.Item
                name="scheduledStartDate"
                label="排期开始日期"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item
                name="scheduledEndDate"
                label="排期结束日期"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectDetail; 