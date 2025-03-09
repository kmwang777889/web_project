import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Descriptions, 
  Button, 
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
  Avatar,
  List,
  Divider,
  Typography,
  Upload,
  Image
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  ArrowLeftOutlined,
  UploadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileImageOutlined,
  DownloadOutlined,
  SendOutlined,
  UserOutlined,
  EyeOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

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

// 文件图标渲染
const renderFileIcon = (mimetype) => {
  if (mimetype.startsWith('image/')) {
    return <FileImageOutlined style={{ fontSize: 24, color: '#1890ff' }} />;
  } else if (mimetype.includes('pdf')) {
    return <FilePdfOutlined style={{ fontSize: 24, color: '#f5222d' }} />;
  } else if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) {
    return <FileExcelOutlined style={{ fontSize: 24, color: '#52c41a' }} />;
  } else if (mimetype.includes('word') || mimetype.includes('document')) {
    return <FileWordOutlined style={{ fontSize: 24, color: '#1890ff' }} />;
  } else {
    return <FileOutlined style={{ fontSize: 24, color: '#faad14' }} />;
  }
};

const WorkItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  
  const [workItem, setWorkItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [projects, setProjects] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [form] = Form.useForm();
  
  // 图片预览状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  
  // 获取工作项详情
  const fetchWorkItem = async () => {
    try {
      setLoading(true);
      const data = await api.getWorkItemById(id);
      console.log('获取到的工作项数据:', data);
      
      // 确保附件字段是数组
      if (data) {
        if (!data.attachments) {
          data.attachments = [];
        } else if (!Array.isArray(data.attachments)) {
          // 如果attachments不是数组，尝试解析它
          try {
            if (typeof data.attachments === 'string') {
              data.attachments = JSON.parse(data.attachments);
            }
            // 确保解析后的结果是数组
            if (!Array.isArray(data.attachments)) {
              data.attachments = [];
            }
          } catch (error) {
            console.error('解析附件信息失败:', error);
            data.attachments = [];
          }
        }
        
        console.log('工作项附件数量:', data.attachments.length);
        if (data.attachments.length > 0) {
          console.log('附件示例:', data.attachments[0]);
        }
      }
      
      setWorkItem(data);
    } catch (error) {
      console.error('获取工作项详情失败:', error);
      message.error('获取工作项详情失败');
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
    fetchWorkItem();
    fetchProjects();
    fetchAdmins();
  }, [id]);
  
  // 打开编辑工作项模态框
  const showEditModal = () => {
    form.resetFields();
    
    if (workItem) {
      // 准备附件数据，转换为Upload组件需要的格式
      const fileList = workItem.attachments && workItem.attachments.length > 0 
        ? workItem.attachments.map((attachment, index) => {
            const isImage = attachment.mimetype.startsWith('image/');
            const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.path}`;
            
            console.log('处理附件:', attachment);
            
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
          }) 
        : [];
      
      console.log('编辑模式下的附件列表:', fileList);
      
      form.setFieldsValue({
        ...workItem,
        projectId: workItem.projectId,
        assigneeId: workItem.assigneeId,
        expectedCompletionDate: workItem.expectedCompletionDate ? dayjs(workItem.expectedCompletionDate) : null,
        scheduledStartDate: workItem.scheduledStartDate ? dayjs(workItem.scheduledStartDate) : null,
        scheduledEndDate: workItem.scheduledEndDate ? dayjs(workItem.scheduledEndDate) : null,
        attachments: fileList // 设置附件列表
      });
    }
    
    setEditModalVisible(true);
  };
  
  // 关闭编辑模态框
  const handleEditCancel = () => {
    setEditModalVisible(false);
  };
  
  // 提交编辑表单
  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields();
      console.log('表单验证通过，提交的值:', values);
      
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
      
      // 创建FormData对象用于文件上传
      const formData = new FormData();
      
      // 添加基本字段
      Object.keys(values).forEach(key => {
        // 跳过attachments字段，单独处理
        if (key !== 'attachments' && values[key] !== undefined && values[key] !== null) {
          formData.append(key, values[key]);
          console.log(`添加字段 ${key}:`, values[key]);
        }
      });
      
      // 处理附件
      const attachments = values.attachments || [];
      console.log('提交的附件列表:', attachments);
      
      // 添加现有附件的信息
      const existingAttachments = [];
      attachments.forEach(file => {
        if (file.originalAttachment) {
          existingAttachments.push(file.originalAttachment);
          console.log('添加现有附件:', file.originalAttachment.originalName);
        }
      });
      
      // 将现有附件信息添加到formData
      if (existingAttachments.length > 0) {
        formData.append('existingAttachments', JSON.stringify(existingAttachments));
        console.log('现有附件数量:', existingAttachments.length);
        console.log('现有附件详情:', JSON.stringify(existingAttachments));
      } else {
        console.log('没有现有附件');
        // 如果没有现有附件，添加一个空数组，确保服务器知道我们要清空附件
        formData.append('existingAttachments', JSON.stringify([]));
      }
      
      // 添加新上传的文件
      let newFileCount = 0;
      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        if (file.originFileObj) {
          console.log('添加新文件到FormData:', file.name, '类型:', file.type, '大小:', file.size);
          
          // 检查文件对象是否有效
          if (!(file.originFileObj instanceof File) && !(file.originFileObj instanceof Blob)) {
            console.error('警告: 文件对象不是有效的File或Blob对象:', file.originFileObj);
            continue;
          }
          
          // 使用索引作为文件名前缀，确保每个文件名唯一
          formData.append(`attachments`, file.originFileObj);
          console.log('文件对象有效:', file.originFileObj.name, file.originFileObj.type, file.originFileObj.size);
          newFileCount++;
        }
      }
      console.log('新上传文件数量:', newFileCount);
      
      // 如果状态变为已完成，添加完成备注
      if (values.status === '已完成' && workItem.status !== '已完成') {
        const comment = {
          content: `工作项已标记为完成`,
          createdAt: new Date().toISOString(),
          userId: currentUser.id,
          username: currentUser.username
        };
        
        formData.append('comment', JSON.stringify(comment));
      }
      
      // 打印formData内容，用于调试
      console.log('FormData内容:');
      for (let pair of formData.entries()) {
        console.log(pair[0], typeof pair[1] === 'string' ? pair[1] : '[文件对象]');
        if (pair[0] === 'attachments') {
          const file = pair[1];
          console.log('文件详情:', {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
          });
        }
      }
      
      // 发送更新请求
      console.log('开始发送更新请求...');
      const response = await api.updateWorkItem(id, formData);
      console.log('更新响应:', response);
      
      message.success('工作项更新成功');
      setEditModalVisible(false);
      
      // 延迟一下再获取工作项数据，确保服务器处理完成
      console.log('等待服务器处理完成...');
      setTimeout(() => {
        console.log('重新获取工作项数据...');
        fetchWorkItem(); // 重新获取工作项数据
      }, 1000);
    } catch (error) {
      console.error('更新工作项失败:', error);
      console.error('错误详情:', error.response ? error.response.data : '无响应数据');
      message.error('更新工作项失败: ' + (error.message || '未知错误'));
    }
  };
  
  // 删除工作项
  const handleDelete = async () => {
    try {
      await api.deleteWorkItem(id);
      message.success('工作项删除成功');
      navigate('/projects');
    } catch (error) {
      console.error('删除工作项失败:', error);
      message.error('删除工作项失败: ' + error.message);
    }
  };
  
  // 提交评论
  const handleCommentSubmit = async () => {
    if (!commentValue.trim()) {
      return;
    }
    
    setSubmittingComment(true);
    
    try {
      await api.addWorkItemComment(id, { content: commentValue });
      message.success('评论添加成功');
      setCommentValue('');
      fetchWorkItem();
    } catch (error) {
      console.error('添加评论失败:', error);
      message.error('添加评论失败: ' + error.message);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  // 删除附件
  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await api.deleteWorkItemAttachment(id, attachmentId);
      message.success('附件删除成功');
      fetchWorkItem();
    } catch (error) {
      console.error('删除附件失败:', error);
      message.error('删除附件失败: ' + error.message);
    }
  };
  
  // 检查用户是否有编辑权限
  const hasEditPermission = () => {
    if (!workItem || !currentUser) return false;
    
    return isAdmin() || workItem.createdById === currentUser.id;
  };
  
  // 处理图片预览
  const handlePreview = (attachment) => {
    const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.path}`;
    setPreviewImage(imageUrl);
    setPreviewTitle(attachment.originalName);
    setPreviewVisible(true);
  };
  
  // 关闭图片预览
  const handlePreviewCancel = () => {
    setPreviewVisible(false);
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }
  
  if (!workItem) {
    return (
      <div>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/projects?tab=workItems')}
        >
          返回工作项列表
        </Button>
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            工作项不存在或已被删除
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="work-item-detail">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/projects?tab=workItems')}
        >
          返回工作项列表
        </Button>
        
        {hasEditPermission() && (
          <Space>
            <Button 
              icon={<EditOutlined />} 
              onClick={showEditModal}
            >
              编辑工作项
            </Button>
            <Popconfirm
              title="确定要删除此工作项吗？"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                icon={<DeleteOutlined />} 
                danger
              >
                删除工作项
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>
      
      {/* 工作项详情 */}
      <Card className="work-item-detail-header">
        <div className="work-item-detail-title">
          <Title level={3}>{workItem.title}</Title>
        </div>
        
        <div className="work-item-detail-meta">
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">类型:</span>
            {renderTypeTag(workItem.type)}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">状态:</span>
            {renderStatusTag(workItem.status)}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">紧急程度:</span>
            {renderPriorityTag(workItem.priority)}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">需求来源:</span>
            {workItem.source || '-'}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">创建者:</span>
            {workItem.creator ? workItem.creator.username : '-'}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">负责人:</span>
            {workItem.assignee ? workItem.assignee.username : '未分配'}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">创建时间:</span>
            {new Date(workItem.createdAt).toLocaleString()}
          </div>
          {workItem.Project && (
            <div className="work-item-detail-meta-item">
              <span className="work-item-detail-meta-label">所属项目:</span>
              <Link to={`/projects/${workItem.Project.id}`}>{workItem.Project.name}</Link>
            </div>
          )}
        </div>
      </Card>
      
      <Card title="详细信息" style={{ marginTop: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="预估工时" span={1}>
            {workItem.estimatedHours ? `${workItem.estimatedHours}小时` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="实际工时" span={1}>
            {workItem.actualHours ? `${workItem.actualHours}小时` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="排期开始日期" span={1}>
            {workItem.scheduledStartDate ? new Date(workItem.scheduledStartDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="排期结束日期" span={1}>
            {workItem.scheduledEndDate ? new Date(workItem.scheduledEndDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="期望完成日期" span={1}>
            {workItem.expectedCompletionDate ? new Date(workItem.expectedCompletionDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="实际完成日期" span={1}>
            {workItem.completionDate ? new Date(workItem.completionDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {workItem.description || '无描述'}
            </div>
          </Descriptions.Item>
        </Descriptions>
      </Card>
      
      {/* 附件 */}
      <Card title="附件" style={{ marginTop: 16 }} className="work-item-detail-attachments">
        {workItem.attachments && workItem.attachments.length > 0 ? (
          <div className="file-upload-list">
            {workItem.attachments.map((attachment, index) => (
              <div key={index} className="file-list-item" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '12px', 
                borderBottom: '1px solid #f0f0f0',
                transition: 'background-color 0.3s',
                borderRadius: '4px',
                marginBottom: '8px',
                backgroundColor: '#fafafa'
              }}>
                <div className="file-icon" style={{ marginRight: '12px' }}>
                  {attachment.mimetype.startsWith('image/') ? (
                    <div 
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        overflow: 'hidden',
                        borderRadius: '4px',
                        border: '1px solid #d9d9d9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => handlePreview(attachment)}
                    >
                      <img 
                        src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.path}`} 
                        alt={attachment.originalName}
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    </div>
                  ) : (
                    renderFileIcon(attachment.mimetype)
                  )}
                </div>
                <div className="file-info" style={{ flex: 1 }}>
                  <div className="file-name" style={{ fontWeight: 'bold' }}>{attachment.originalName}</div>
                  <div className="file-size" style={{ color: '#888', fontSize: '12px' }}>
                    {(attachment.size / 1024).toFixed(2)} KB
                  </div>
                </div>
                <div className="file-actions">
                  {attachment.mimetype.startsWith('image/') && (
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(attachment)}
                    >
                      预览
                    </Button>
                  )}
                  <Button 
                    type="link" 
                    icon={<DownloadOutlined />}
                    href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.path}`}
                    target="_blank"
                  >
                    下载
                  </Button>
                  {hasEditPermission() && (
                    <Popconfirm
                      title="确定要删除此附件吗？"
                      onConfirm={() => handleDeleteAttachment(attachment.filename)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button 
                        type="link" 
                        danger
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
            暂无附件
          </div>
        )}
      </Card>
      
      {/* 评论 */}
      <Card title="评论" style={{ marginTop: 16 }} className="work-item-detail-comments">
        {workItem.comments && workItem.comments.length > 0 ? (
          <List
            dataSource={workItem.comments}
            itemLayout="horizontal"
            renderItem={comment => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />}>{comment.username.charAt(0).toUpperCase()}</Avatar>}
                  title={<div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <a>{comment.username}</a>
                    <Text type="secondary">{new Date(comment.createdAt).toLocaleString()}</Text>
                  </div>}
                  description={<Paragraph className="comment-text">{comment.content}</Paragraph>}
                />
              </List.Item>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
            暂无评论
          </div>
        )}
        
        <Divider />
        
        <div style={{ display: 'flex', marginTop: 16 }}>
          <TextArea
            rows={4}
            value={commentValue}
            onChange={e => setCommentValue(e.target.value)}
            placeholder="添加评论..."
            style={{ marginRight: 16, flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={submittingComment}
            onClick={handleCommentSubmit}
            disabled={!commentValue.trim()}
          >
            发送
          </Button>
        </div>
      </Card>
      
      {/* 编辑工作项模态框 */}
      <Modal
        title="编辑工作项"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={handleEditCancel}
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
              
              {form.getFieldValue('status') === '已完成' && workItem.status !== '已完成' && (
                <Form.Item
                  name="actualHours"
                  label="实际工时(小时)"
                >
                  <Input type="number" min={0} step={0.5} />
                </Form.Item>
              )}
              
              {form.getFieldValue('status') === '已完成' && workItem.status !== '已完成' && (
                <Form.Item
                  name="completionComment"
                  label="完成说明"
                >
                  <Input.TextArea rows={3} placeholder="请输入完成说明" />
                </Form.Item>
              )}
            </>
          )}
          
          <Form.Item
            name="attachments"
            label="添加附件"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              console.log('Upload event:', e);
              if (Array.isArray(e)) {
                console.log('Upload event是数组，长度:', e.length);
                return e;
              }
              // 确保返回的是数组
              const fileList = e && e.fileList ? e.fileList : [];
              console.log('Upload fileList:', fileList);
              return fileList;
            }}
          >
            <Upload
              beforeUpload={(file) => {
                console.log('beforeUpload:', file.name, '类型:', file.type, '大小:', file.size);
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
                } else if (status === 'error') {
                  console.error('文件上传错误:', info.file.name, info.file.error);
                  message.error(`文件 ${info.file.name} 上传失败`);
                }
              }}
              onPreview={(file) => {
                console.log('onPreview:', file);
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
              }}
              customRequest={({ file, onSuccess }) => {
                // 自定义上传逻辑，这里只是模拟成功
                setTimeout(() => {
                  onSuccess("ok");
                }, 0);
              }}
              accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
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

export default WorkItemDetail; 