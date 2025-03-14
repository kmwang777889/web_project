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
  Image,
  Tabs,
  Timeline
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
  PlusOutlined,
  CommentOutlined,
  ClockCircleOutlined,
  TagOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { renderPriorityTag, renderStatusTag, renderTypeTag } from '../utils/tagRenderers';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

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
  
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // 添加当前活动标签页状态
  const [activeTabKey, setActiveTabKey] = useState('details');
  
  // 获取工作项详情
  const fetchWorkItem = async () => {
    try {
      setLoading(true);
      const data = await api.getWorkItemById(id);
      console.log('获取到的工作项数据:', data);
      
      // 确保附件字段是数组
      if (data) {
        // 处理附件字段
        if (!data.attachments) {
          data.attachments = [];
          console.log('工作项没有附件，设置为空数组');
        } else if (typeof data.attachments === 'string') {
          try {
            // 尝试解析JSON字符串
            const parsedAttachments = JSON.parse(data.attachments);
            if (Array.isArray(parsedAttachments)) {
              data.attachments = parsedAttachments;
              console.log('成功解析附件字符串为数组');
            } else {
              console.error('解析后的附件不是数组:', parsedAttachments);
              data.attachments = [];
            }
          } catch (error) {
            console.error('解析附件信息失败:', error);
            data.attachments = [];
          }
        } else if (!Array.isArray(data.attachments)) {
          console.error('附件字段既不是字符串也不是数组:', typeof data.attachments);
          data.attachments = [];
        }
        
        console.log('工作项附件数量:', data.attachments.length);
        if (data.attachments.length > 0) {
          console.log('附件示例:', data.attachments[0]);
          
          // 确保每个附件都有正确的路径
          data.attachments = data.attachments.map(attachment => {
            if (!attachment || !attachment.path) {
              console.warn('附件缺少路径:', attachment);
              return null;
            }
            return attachment;
          }).filter(Boolean); // 过滤掉null值
          
          console.log('处理后的附件数量:', data.attachments.length);
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
  
  // 获取工作项活动历史
  const fetchActivities = async () => {
    try {
      setLoadingActivities(true);
      const data = await api.getWorkItemActivities(id);
      setActivities(data);
    } catch (error) {
      console.error('获取活动历史失败:', error);
      message.error('获取活动历史失败');
    } finally {
      setLoadingActivities(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchWorkItem();
    fetchProjects();
    fetchAdmins();
    if (id) {
      fetchActivities();
    }
  }, [id]);
  
  // 打开编辑工作项模态框
  const showEditModal = () => {
    try {
      console.log('开始打开编辑模态框');
      form.resetFields();
      
      if (!workItem) {
        console.log('工作项不存在，无法打开编辑模态框');
        return;
      }
      
      console.log('工作项存在，准备设置表单值');
      
      // 设置基本表单值（不包括附件）
      const formValues = {
        ...workItem,
        projectId: workItem.projectId,
        assigneeId: workItem.assigneeId,
        expectedCompletionDate: workItem.expectedCompletionDate ? dayjs(workItem.expectedCompletionDate) : null,
        scheduledStartDate: workItem.scheduledStartDate ? dayjs(workItem.scheduledStartDate) : null,
        scheduledEndDate: workItem.scheduledEndDate ? dayjs(workItem.scheduledEndDate) : null,
      };
      
      // 单独处理附件
      let fileList = [];
      
      // 安全地获取附件数组
      let attachments = [];
      
      if (workItem.attachments) {
        console.log('工作项有附件字段，类型:', typeof workItem.attachments);
        
        // 确保附件是数组
        if (typeof workItem.attachments === 'string') {
          try {
            const parsed = JSON.parse(workItem.attachments);
            if (Array.isArray(parsed)) {
              attachments = parsed;
              console.log('成功解析附件字符串为数组，长度:', attachments.length);
            } else {
              console.warn('解析后的attachments不是数组:', parsed);
            }
          } catch (error) {
            console.error('解析附件字符串失败:', error);
          }
        } else if (Array.isArray(workItem.attachments)) {
          attachments = workItem.attachments;
          console.log('附件已经是数组，长度:', attachments.length);
        } else {
          console.warn('工作项附件既不是字符串也不是数组:', typeof workItem.attachments);
        }
      } else {
        console.log('工作项没有附件字段');
      }
      
      // 只有当attachments是数组且有元素时才处理
      if (Array.isArray(attachments) && attachments.length > 0) {
        console.log('开始处理附件数组，长度:', attachments.length);
        
        // 逐个处理附件，而不是使用map
        for (let i = 0; i < attachments.length; i++) {
          const attachment = attachments[i];
          
          // 检查附件是否有效
          if (!attachment || !attachment.mimetype || !attachment.path) {
            console.warn('附件缺少必要字段:', attachment);
            continue;
          }
          
          const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');
          const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.path}`;
          
          console.log('处理附件:', attachment);
          
          fileList.push({
            uid: `-${i}`, // 负数表示已经存在的文件
            name: attachment.originalName || '未命名文件',
            status: 'done',
            url: fileUrl, // 文件访问地址
            thumbUrl: isImage ? fileUrl : undefined, // 如果是图片，提供缩略图
            type: attachment.mimetype,
            size: attachment.size || 0,
            // 保存原始附件信息，用于后续处理
            originalAttachment: attachment
          });
        }
      }
      
      console.log('编辑模式下的附件列表:', fileList);
      
      // 设置附件表单值
      formValues.attachments = fileList;
      form.setFieldsValue(formValues);
      console.log('表单值设置成功');
      
      // 打开模态框
      setEditModalVisible(true);
    } catch (error) {
      console.error('打开编辑模态框时出错:', error);
      message.error('打开编辑模态框失败: ' + (error.message || '未知错误'));
    }
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
      
      // 创建FormData对象用于提交表单数据
      const formData = new FormData();
      
      // 添加表单字段
      Object.keys(values).forEach(key => {
        // 跳过attachments字段，不再处理附件
        if (key !== 'attachments' && values[key] !== undefined && values[key] !== null) {
          // 检查字段值是否发生变化
          let isChanged = false;
          
          // 日期字段特殊处理
          if (key.includes('Date') && workItem[key]) {
            // 将两个日期都转换为YYYY-MM-DD格式进行比较
            const formattedNewValue = values[key];
            const formattedOldValue = new Date(workItem[key]).toISOString().split('T')[0];
            isChanged = formattedNewValue !== formattedOldValue;
          } else {
            // 其他字段直接比较字符串
            isChanged = String(values[key]) !== String(workItem[key]);
          }
          
          if (isChanged) {
            formData.append(key, values[key]);
            console.log(`添加已修改字段 ${key}:`, values[key], '原值:', workItem[key]);
          } else {
            console.log(`跳过未修改字段 ${key}`);
          }
        }
      });
      
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
        fetchActivities(); // 重新获取活动历史
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
      fetchActivities(); // 重新获取活动历史
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
      fetchActivities(); // 重新获取活动历史
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
  
  // 渲染活动图标
  const renderActivityIcon = (type) => {
    switch (type) {
      case 'create':
        return <PlusOutlined style={{ color: '#52c41a' }} />;
      case 'update':
        return <EditOutlined style={{ color: '#1890ff' }} />;
      case 'status_change':
        return <TagOutlined style={{ color: '#722ed1' }} />;
      case 'assignee_change':
        return <UserOutlined style={{ color: '#fa8c16' }} />;
      case 'comment':
        return <CommentOutlined style={{ color: '#13c2c2' }} />;
      case 'attachment_add':
        return <FileOutlined style={{ color: '#1890ff' }} />;
      case 'attachment_delete':
        return <DeleteOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <ClockCircleOutlined />;
    }
  };
  
  // 字段名称翻译
  const translateFieldName = (fieldName) => {
    const fieldMap = {
      'title': '标题',
      'description': '描述',
      'type': '类型',
      'status': '状态',
      'priority': '紧急程度',
      'source': '需求来源',
      'estimatedHours': '预估工时',
      'actualHours': '实际工时',
      'scheduledStartDate': '排期开始日期',
      'scheduledEndDate': '排期结束日期',
      'expectedCompletionDate': '期望完成日期',
      'completionDate': '实际完成日期',
      'projectId': '所属项目',
      'assigneeId': '负责人'
    };
    
    return fieldMap[fieldName] || fieldName;
  };
  
  // 格式化活动描述
  const formatActivityDescription = (activity) => {
    if (!activity.field) {
      return activity.description;
    }
    
    // 替换描述中的字段名称
    const fieldDisplayName = translateFieldName(activity.field);
    
    // 根据活动类型格式化描述
    switch (activity.type) {
      case 'create':
        return `创建了工作项`;
      case 'update':
        // 对于日期字段，格式化显示
        if (activity.field.includes('Date')) {
          const oldValue = activity.oldValue ? new Date(activity.oldValue).toLocaleDateString() : '空';
          const newValue = activity.newValue ? new Date(activity.newValue).toLocaleDateString() : '空';
          return `修改了 ${fieldDisplayName} 字段，从 "${oldValue}" 修改为 "${newValue}"`;
        }
        // 对于普通字段
        return `修改了 ${fieldDisplayName} 字段，从 "${activity.oldValue || '空'}" 修改为 "${activity.newValue}"`;
      case 'status_change':
        return `将状态从 "${activity.oldValue}" 修改为 "${activity.newValue}"`;
      case 'assignee_change':
        return activity.description.replace(activity.field, fieldDisplayName);
      case 'comment':
        return `添加了评论: "${activity.newValue}"`;
      case 'attachment_add':
        return `添加了附件: "${activity.newValue}"`;
      case 'attachment_delete':
        return `删除了附件: "${activity.oldValue}"`;
      default:
        return activity.description.replace(activity.field, fieldDisplayName);
    }
  };
  
  // 处理附件下载
  const handleDownloadAttachment = (attachment) => {
    try {
      console.log('开始下载附件:', attachment);
      
      // 构建完整的URL
      const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.path}`;
      console.log('下载URL:', fileUrl);
      
      // 使用API工具下载文件
      api.downloadFile(attachment.path, attachment.originalName);
      
      // 记录下载成功
      console.log('附件下载请求已发送');
    } catch (error) {
      console.error('下载附件失败:', error);
      message.error('下载附件失败: ' + error.message);
    }
  };
  
  // 处理文件上传
  const handleUploadAttachment = async () => {
    try {
      // 确保当前标签页是附件标签页
      setActiveTabKey('attachments');
      
      // 创建一个文件选择器
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt';
      
      // 当用户选择文件后触发上传
      fileInput.onchange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          
          // 显示正在上传的消息
          const loadingMessage = message.loading('正在上传文件...', 0);
          
          try {
            console.log('开始上传文件:', file.name, '类型:', file.type, '大小:', file.size);
            
            // 使用附件上传API
            const result = await api.uploadAttachmentFile(file);
            console.log('上传结果:', result);
            
            if (result && result.success) {
              // 上传成功后，将文件添加到工作项的附件中
              const attachment = {
                filename: result.file.filename,
                originalName: result.file.originalname,
                path: result.file.path, // 使用服务器返回的路径
                mimetype: result.file.mimetype,
                size: result.file.size
              };
              
              console.log('服务器返回的附件信息:', attachment);
              
              // 创建FormData对象用于更新工作项
              const updateFormData = new FormData();
              
              // 获取当前附件列表
              let currentAttachments = [];
              
              // 确保工作项存在
              if (!workItem) {
                console.error('工作项不存在，无法更新附件');
                loadingMessage();
                message.error('更新失败: 工作项不存在');
                return;
              }
              
              // 安全地获取当前附件
              if (workItem.attachments) {
                if (typeof workItem.attachments === 'string') {
                  try {
                    const parsed = JSON.parse(workItem.attachments);
                    if (Array.isArray(parsed)) {
                      currentAttachments = parsed;
                    } else {
                      console.warn('解析后的attachments不是数组:', parsed);
                      currentAttachments = [];
                    }
                  } catch (error) {
                    console.error('解析附件字符串失败:', error);
                    currentAttachments = [];
                  }
                } else if (Array.isArray(workItem.attachments)) {
                  currentAttachments = [...workItem.attachments];
                } else {
                  console.warn('工作项附件既不是字符串也不是数组:', typeof workItem.attachments);
                  currentAttachments = [];
                }
              }
              
              console.log('当前附件数量:', currentAttachments.length);
              
              // 添加新附件
              const updatedAttachments = [...currentAttachments, attachment];
              console.log('更新后的附件数量:', updatedAttachments.length);
              
              // 将更新后的附件列表添加到FormData
              updateFormData.append('existingAttachments', JSON.stringify(updatedAttachments));
              
              // 发送更新请求
              console.log('更新工作项附件...');
              await api.updateWorkItem(id, updateFormData);
              
              // 关闭加载消息
              loadingMessage();
              
              // 显示成功消息
              message.success(`文件 ${file.name} 上传成功并添加到工作项`);
              
              // 重新获取工作项数据
              fetchWorkItem();
              fetchActivities();
            } else {
              // 关闭加载消息
              loadingMessage();
              
              // 显示错误消息
              message.error('上传失败: ' + (result?.message || '未知错误'));
            }
          } catch (error) {
            // 关闭加载消息
            loadingMessage();
            
            console.error('上传失败:', error);
            message.error('上传失败: ' + (error.message || '未知错误'));
          }
        }
      };
      
      // 触发文件选择器
      fileInput.click();
    } catch (error) {
      console.error('创建文件选择器失败:', error);
      message.error('上传失败: ' + (error.message || '未知错误'));
    }
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
        
        <Space>
          {hasEditPermission() && (
            <>
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
            </>
          )}
          {hasEditPermission() && (
            <Button 
              icon={<UploadOutlined />} 
              onClick={handleUploadAttachment}
            >
              上传附件
            </Button>
          )}
        </Space>
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
      
      <Card style={{ marginTop: 16 }}>
        <Tabs 
          activeKey={activeTabKey} 
          onChange={setActiveTabKey}
        >
          <TabPane tab="详情" key="details">
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
          </TabPane>
          
          <TabPane tab="活动" key="activities">
            {loadingActivities ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin />
              </div>
            ) : (
              <Timeline>
                {activities.map(activity => (
                  <Timeline.Item
                    key={activity.id}
                    dot={renderActivityIcon(activity.type)}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ marginRight: 8 }}>
                        <strong>{activity.User.username}</strong>
                      </span>
                      <span style={{ color: '#8c8c8c' }}>
                        {new Date(activity.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>{formatActivityDescription(activity)}</div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </TabPane>
          
          <TabPane tab="附件" key="attachments">
            {(() => {
              try {
                // 安全地获取附件数组
                let attachments = [];
                
                if (workItem.attachments) {
                  if (typeof workItem.attachments === 'string') {
                    try {
                      const parsed = JSON.parse(workItem.attachments);
                      if (Array.isArray(parsed)) {
                        attachments = parsed;
                      }
                    } catch (error) {
                      console.error('解析附件字符串失败:', error);
                    }
                  } else if (Array.isArray(workItem.attachments)) {
                    attachments = workItem.attachments;
                  }
                }
                
                // 渲染附件列表
                if (attachments.length > 0) {
                  return (
                    <div className="file-upload-list">
                      {attachments.map((attachment, index) => {
                        // 确保attachment和mimetype存在
                        if (!attachment || !attachment.mimetype) {
                          return null;
                        }
                        
                        return (
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
                                onClick={() => handleDownloadAttachment(attachment)}
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
                        );
                      })}
                    </div>
                  );
                } else {
                  return (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
                      暂无附件
                    </div>
                  );
                }
              } catch (error) {
                console.error('渲染附件列表时出错:', error);
                return (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#f5222d' }}>
                    加载附件失败: {error.message || '未知错误'}
                  </div>
                );
              }
            })()}
          </TabPane>
        </Tabs>
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
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="projectId"
              label="所属项目"
              style={{ flex: 1 }}
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
              style={{ flex: 1 }}
            >
              <Select>
                <Option value="规划">规划</Option>
                <Option value="需求">需求</Option>
                <Option value="事务">事务</Option>
                <Option value="缺陷">缺陷</Option>
              </Select>
            </Form.Item>
          </div>
          
          <Form.Item
            name="description"
            label="描述"
            style={{ marginBottom: '20px' }}
          >
            <Input.TextArea 
              rows={6} 
              placeholder="请输入描述" 
              style={{ 
                fontSize: '14px',
                resize: 'vertical',
                minHeight: '120px'
              }}
            />
          </Form.Item>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="status"
              label="状态"
              style={{ flex: 1 }}
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
              style={{ flex: 1 }}
            >
              <Select>
                <Option value="紧急">紧急</Option>
                <Option value="高">高</Option>
                <Option value="中">中</Option>
                <Option value="低">低</Option>
              </Select>
            </Form.Item>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="source"
              label="需求来源"
              style={{ flex: 1 }}
            >
              <Select allowClear>
                <Option value="内部需求">内部需求</Option>
                <Option value="品牌需求">品牌需求</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              name="assigneeId"
              label="负责人"
              style={{ flex: 1 }}
            >
              <Select allowClear placeholder="请选择负责人">
                {admins.map(admin => (
                  <Option key={admin.id} value={admin.id}>
                    {admin.username} ({admin.role === 'super_admin' ? '超级管理员' : '管理员'})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="expectedCompletionDate"
              label="期望完成日期"
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            
            {isAdmin() && (
              <Form.Item
                name="estimatedHours"
                label="预估工时(小时)"
                style={{ flex: 1 }}
              >
                <Input type="number" min={0} step={0.5} />
              </Form.Item>
            )}
          </div>
          
          {isAdmin() && (
            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item
                name="scheduledStartDate"
                label="排期开始日期"
                style={{ flex: 1 }}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item
                name="scheduledEndDate"
                label="排期结束日期"
                style={{ flex: 1 }}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </div>
          )}
          
          {isAdmin() && form.getFieldValue('status') === '已完成' && workItem.status !== '已完成' && (
            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item
                name="actualHours"
                label="实际工时(小时)"
                style={{ flex: 1 }}
              >
                <Input type="number" min={0} step={0.5} />
              </Form.Item>
              
              <Form.Item
                name="completionComment"
                label="完成说明"
                style={{ flex: 2 }}
              >
                <Input.TextArea rows={2} placeholder="请输入完成说明" />
              </Form.Item>
            </div>
          )}
          
          {/* 移除附件上传表单项 */}
          <div style={{ marginTop: 16, color: '#1890ff' }}>
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            请使用"上传附件"按钮上传文件
          </div>
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