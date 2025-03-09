import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Input, 
  Select, 
  DatePicker, 
  Modal, 
  Form, 
  message, 
  Popconfirm, 
  Tag, 
  Space,
  Upload,
  Image
} from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import * as XLSX from 'xlsx';

const { Option } = Select;
const { RangePicker } = DatePicker;

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

const WorkItemList = () => {
  const [workItems, setWorkItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkItem, setEditingWorkItem] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [form] = Form.useForm();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // 图片预览状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  
  // 筛选条件
  const [filters, setFilters] = useState({
    title: '',
    projectId: '',
    type: '',
    status: '',
    priority: '',
    assigneeId: '',
    source: '',
    startDate: '',
    endDate: '',
    createdById: ''
  });
  
  // 获取工作项列表
  const fetchWorkItems = async () => {
    try {
      setLoading(true);
      // 移除未定义的参数
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== undefined && v !== '')
      );
      
      const response = await api.getWorkItems(params);
      console.log('工作项数据:', response); // 调试日志
      
      // 修改这里：确保response是一个数组，如果不是则检查response.data
      // 如果response.data也不是数组，则使用空数组
      if (Array.isArray(response)) {
        setWorkItems(response);
      } else if (response && Array.isArray(response.data)) {
        setWorkItems(response.data);
      } else {
        setWorkItems([]);
      }
    } catch (error) {
      console.error('获取工作项列表失败:', error);
      message.error('获取工作项列表失败');
      setWorkItems([]);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取项目列表
  const fetchProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('获取项目列表失败:', error);
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
    fetchWorkItems();
    fetchProjects();
    fetchAdmins();
  }, []);
  
  // 当筛选条件变化时重新获取数据
  useEffect(() => {
    fetchWorkItems();
  }, [filters]);
  
  // 处理筛选条件变化
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 处理日期范围变化
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD')
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        startDate: '',
        endDate: ''
      }));
    }
  };
  
  // 重置筛选条件
  const resetFilters = () => {
    setFilters({
      title: '',
      projectId: '',
      type: '',
      status: '',
      priority: '',
      assigneeId: '',
      source: '',
      startDate: '',
      endDate: '',
      createdById: ''
    });
  };
  
  // 打开创建/编辑工作项模态框
  const showModal = (workItem = null) => {
    setEditingWorkItem(workItem);
    form.resetFields();
    
    if (workItem) {
      // 准备附件数据，转换为Upload组件需要的格式
      const fileList = workItem.attachments ? workItem.attachments.map((attachment, index) => {
        const isImage = attachment.mimetype.startsWith('image/');
        const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.path}`;
        
        return {
          uid: `-${index}`, // 负数表示已经存在的文件
          name: attachment.originalName,
          status: 'done',
          url: fileUrl, // 文件访问地址
          thumbUrl: isImage ? fileUrl : undefined, // 如果是图片，提供缩略图
          type: attachment.mimetype,
          size: attachment.size,
          // 保存原始附件信息，用于后续处理
          originalAttachment: attachment
        };
      }) : [];
      
      form.setFieldsValue({
        ...workItem,
        expectedCompletionDate: workItem.expectedCompletionDate ? dayjs(workItem.expectedCompletionDate) : null,
        scheduledStartDate: workItem.scheduledStartDate ? dayjs(workItem.scheduledStartDate) : null,
        scheduledEndDate: workItem.scheduledEndDate ? dayjs(workItem.scheduledEndDate) : null,
        attachments: fileList // 设置附件列表
      });
      
      console.log('编辑模式下的附件列表:', fileList);
    }
    
    setModalVisible(true);
  };
  
  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
    setEditingWorkItem(null);
    form.resetFields();
  };
  
  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 处理日期格式
      if (values.expectedCompletionDate) {
        values.expectedCompletionDate = values.expectedCompletionDate.format('YYYY-MM-DD');
      }
      
      if (values.scheduledStartDate) {
        values.scheduledStartDate = values.scheduledStartDate.format('YYYY-MM-DD');
      }
      
      if (values.scheduledEndDate) {
        values.scheduledEndDate = values.scheduledEndDate.format('YYYY-MM-DD');
      }
      
      // 处理文件上传
      const formData = new FormData();
      
      // 添加基本字段
      Object.keys(values).forEach(key => {
        if (key !== 'attachments' && values[key] !== undefined && values[key] !== null) {
          formData.append(key, values[key]);
        }
      });
      
      // 添加附件
      if (values.attachments && values.attachments.length > 0) {
        console.log('处理附件上传:', values.attachments);
        
        // 遍历附件列表
        values.attachments.forEach(file => {
          // 只上传新添加的文件（有originFileObj属性的文件）
          if (file.originFileObj) {
            console.log('上传新文件:', file.name);
            formData.append('attachments', file.originFileObj);
          }
        });
      }
      
      // 打印formData内容，便于调试
      for (let pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }
      
      if (editingWorkItem) {
        // 更新工作项
        await api.updateWorkItem(editingWorkItem.id, formData);
        message.success('工作项更新成功');
      } else {
        // 创建工作项
        await api.createWorkItem(formData);
        message.success('工作项创建成功');
      }
      
      setModalVisible(false);
      fetchWorkItems();
    } catch (error) {
      console.error('保存工作项失败:', error);
      message.error('保存工作项失败: ' + error.message);
    }
  };
  
  // 删除工作项
  const handleDelete = async (id) => {
    try {
      await api.deleteWorkItem(id);
      message.success('工作项删除成功');
      fetchWorkItems();
    } catch (error) {
      console.error('删除工作项失败:', error);
      message.error('删除工作项失败: ' + error.message);
    }
  };
  
  // 导出工作项
  const handleExport = async () => {
    try {
      message.loading({ content: '正在导出工作项...', key: 'exportLoading' });
      
      // 检查是否有工作项可导出
      if (workItems.length === 0) {
        message.warning({ content: '没有工作项可导出，请先查询工作项', key: 'exportLoading' });
        return;
      }
      
      console.log('开始导出工作项，过滤条件:', filters);
      
      // 调用服务器端导出API
      const response = await api.exportWorkItems(filters);
      console.log('导出API响应:', response);
      
      if (response && response.success && response.downloadUrl) {
        // 使用API工具中的下载函数
        try {
          console.log('开始下载文件:', response.downloadUrl);
          api.downloadFile(response.downloadUrl, response.filename || `工作项导出_${new Date().toLocaleDateString()}.xlsx`);
          message.success({ content: response.message || `已成功导出 ${response.count} 个工作项`, key: 'exportLoading' });
        } catch (downloadError) {
          console.error('下载文件失败:', downloadError);
          message.error({ 
            content: `导出成功但下载失败: ${downloadError.message}。请尝试直接访问 ${window.location.origin}${response.downloadUrl}`, 
            key: 'exportLoading',
            duration: 10
          });
        }
      } else {
        throw new Error('导出失败，未获取到下载链接');
      }
    } catch (error) {
      console.error('导出工作项失败:', error);
      
      // 显示更详细的错误信息
      let errorMsg = '导出工作项失败';
      if (error.message) {
        errorMsg += ': ' + error.message;
      }
      
      message.error({ 
        content: errorMsg, 
        key: 'exportLoading',
        duration: 10
      });
    }
  };
  
  // 处理图片预览
  const handlePreview = (file) => {
    // 如果是图片，则预览
    if (file.type && file.type.startsWith('image/')) {
      // 如果有url（已上传的文件）或thumbUrl（本地预览）
      const previewUrl = file.url || file.thumbUrl;
      if (previewUrl) {
        setPreviewImage(previewUrl);
        setPreviewTitle(file.name);
        setPreviewVisible(true);
      }
    } else {
      // 如果不是图片，则下载
      if (file.url) {
        window.open(file.url);
      }
    }
  };
  
  // 关闭图片预览
  const handlePreviewCancel = () => {
    setPreviewVisible(false);
  };
  
  // 表格列定义
  const columns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
      sortDirections: ['descend', 'ascend']
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (text, record) => (
        <Link to={`/work-items/${record.id}`}>{text}</Link>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
      sorter: (a, b) => {
        const aDesc = a.description || '';
        const bDesc = b.description || '';
        return aDesc.localeCompare(bDesc);
      },
      sortDirections: ['ascend', 'descend'],
      render: (text) => text || '-'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      sorter: (a, b) => a.type.localeCompare(b.type),
      render: renderTypeTag
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: renderStatusTag
    },
    {
      title: '紧急程度',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      sorter: (a, b) => {
        const priorityOrder = { '紧急': 0, '高': 1, '中': 2, '低': 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      },
      render: renderPriorityTag
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      width: 120,
      sorter: (a, b) => {
        const aName = a.creator ? a.creator.username : '';
        const bName = b.creator ? b.creator.username : '';
        return aName.localeCompare(bName);
      },
      render: (creator) => creator ? creator.username : '-'
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 120,
      sorter: (a, b) => {
        const aName = a.assignee ? a.assignee.username : '';
        const bName = b.assignee ? b.assignee.username : '';
        return aName.localeCompare(bName);
      },
      render: (assignee) => assignee ? assignee.username : '未分配'
    },
    {
      title: '需求来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      sorter: (a, b) => {
        const aSource = a.source || '';
        const bSource = b.source || '';
        return aSource.localeCompare(bSource);
      },
      sortDirections: ['ascend', 'descend'],
      render: (source) => source || '-'
    },
    {
      title: '期望完成日期',
      dataIndex: 'expectedCompletionDate',
      key: 'expectedCompletionDate',
      width: 120,
      sorter: (a, b) => {
        const aDate = a.expectedCompletionDate ? new Date(a.expectedCompletionDate) : null;
        const bDate = b.expectedCompletionDate ? new Date(b.expectedCompletionDate) : null;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate - bDate;
      },
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '开始日期',
      dataIndex: 'scheduledStartDate',
      key: 'scheduledStartDate',
      width: 120,
      sorter: (a, b) => {
        const aDate = a.scheduledStartDate ? new Date(a.scheduledStartDate) : null;
        const bDate = b.scheduledStartDate ? new Date(b.scheduledStartDate) : null;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate - bDate;
      },
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '结束日期',
      dataIndex: 'scheduledEndDate',
      key: 'scheduledEndDate',
      width: 120,
      sorter: (a, b) => {
        const aDate = a.scheduledEndDate ? new Date(a.scheduledEndDate) : null;
        const bDate = b.scheduledEndDate ? new Date(b.scheduledEndDate) : null;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate - bDate;
      },
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '完成日期',
      dataIndex: 'completionDate',
      key: 'completionDate',
      width: 120,
      sorter: (a, b) => {
        const aDate = a.completionDate ? new Date(a.completionDate) : null;
        const bDate = b.completionDate ? new Date(b.completionDate) : null;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate - bDate;
      },
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        const canEdit = isAdmin() || (record.creator && record.creator.id === currentUser.id);
        
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
                  onClick={() => showModal(record)}
                />
                <Popconfirm
                  title="确定要删除此工作项吗？"
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
              </>
            )}
          </Space>
        );
      }
    }
  ];
  
  // 上传文件前的验证
  const beforeUpload = (file) => {
    const isValidSize = file.size / 1024 / 1024 < 20; // 20MB
    if (!isValidSize) {
      message.error('文件大小不能超过20MB!');
    }
    return false; // 阻止自动上传
  };
  
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
              placeholder="项目"
              style={{ width: 150 }}
              value={filters.projectId || undefined}
              onChange={(value) => handleFilterChange('projectId', value)}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {projects.map(project => (
                <Option key={project.id} value={project.id}>{project.name}</Option>
              ))}
            </Select>
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
              placeholder="状态"
              style={{ width: 150 }}
              value={filters.status || undefined}
              onChange={(value) => handleFilterChange('status', value)}
              allowClear
            >
              <Option value="待处理">待处理</Option>
              <Option value="进行中">进行中</Option>
              <Option value="已完成">已完成</Option>
              <Option value="关闭">关闭</Option>
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
            <Select
              placeholder="负责人"
              style={{ width: 150 }}
              value={filters.assigneeId || undefined}
              onChange={(value) => handleFilterChange('assigneeId', value)}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {admins.map(admin => (
                <Option key={admin.id} value={admin.id}>
                  {admin.username} ({admin.role === 'super_admin' ? '超级管理员' : '管理员'})
                </Option>
              ))}
            </Select>
            <Button 
              icon={<FilterOutlined />} 
              onClick={resetFilters}
            >
              重置筛选
            </Button>
          </div>
          
          <div>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => showModal()}
              style={{ marginRight: 12 }}
            >
              创建工作项
            </Button>
            <Button 
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              导出
            </Button>
          </div>
        </div>
      </Card>
      
      {/* 工作项列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={workItems}
          rowKey="id"
          loading={loading}
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showQuickJumper: true,
            showTotal: total => `共 ${total} 条记录`,
            position: ['bottomRight']
          }}
          scroll={{ x: 1800 }}
          size="middle"
          bordered
        />
      </Card>
      
      {/* 创建/编辑工作项模态框 */}
      <Modal
        title={editingWorkItem ? '编辑工作项' : '创建工作项'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题" />
          </Form.Item>
          
          <Form.Item
            name="projectId"
            label="所属项目"
          >
            <Select allowClear placeholder="请选择项目">
              {projects.map(project => (
                <Option key={project.id} value={project.id}>{project.name}</Option>
              ))}
            </Select>
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
          
          <Form.Item
            name="attachments"
            label="附件"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              console.log('Upload event:', e);
              if (Array.isArray(e)) {
                return e;
              }
              return e && e.fileList ? e.fileList : [];
            }}
          >
            <Upload
              beforeUpload={(file) => {
                const isValidSize = file.size / 1024 / 1024 < 20; // 20MB
                if (!isValidSize) {
                  message.error('文件大小不能超过20MB!');
                  return Upload.LIST_IGNORE;
                }
                // 返回false阻止自动上传，但允许文件添加到列表中
                return false;
              }}
              multiple
              listType="picture-card"
              onChange={(info) => {
                console.log('Upload onChange:', info);
                // 可以在这里处理上传状态变化
                const { status } = info.file;
                if (status === 'removed') {
                  // 文件被移除时的处理
                  console.log('文件已移除:', info.file.name);
                }
              }}
              onPreview={handlePreview}
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传文件</div>
              </div>
            </Upload>
            <div style={{ marginTop: 8, color: '#888' }}>
              支持图片和文档，单个文件不超过20MB
            </div>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 图片预览模态框 */}
      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={handlePreviewCancel}
        width={800}
        style={{ top: 20 }}
        bodyStyle={{ padding: '24px', textAlign: 'center' }}
      >
        <img 
          alt={previewTitle} 
          style={{ 
            maxWidth: '100%', 
            maxHeight: 'calc(100vh - 200px)',
            objectFit: 'contain'
          }} 
          src={previewImage} 
        />
      </Modal>
    </div>
  );
};

export default WorkItemList; 