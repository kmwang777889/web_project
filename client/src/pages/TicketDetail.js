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
  message, 
  Spin,
  Avatar,
  List,
  Divider,
  Typography
} from 'antd';
import { 
  EditOutlined, 
  ArrowLeftOutlined,
  SendOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
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

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [form] = Form.useForm();
  
  // 获取工单详情
  const fetchTicket = async () => {
    try {
      setLoading(true);
      const data = await api.getTicketById(id);
      setTicket(data);
    } catch (error) {
      console.error('获取工单详情失败:', error);
      message.error('获取工单详情失败');
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
    fetchTicket();
    fetchAdmins();
  }, [id]);
  
  // 打开编辑工单模态框
  const showEditModal = () => {
    form.resetFields();
    
    if (ticket) {
      form.setFieldsValue({
        status: ticket.status,
        assigneeId: ticket.assigneeId
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
      
      // 如果有评论，添加到表单数据
      if (values.comment) {
        values.comment = values.comment.trim();
      }
      
      await api.updateTicket(id, values);
      message.success('工单更新成功');
      
      setEditModalVisible(false);
      fetchTicket();
    } catch (error) {
      console.error('更新工单失败:', error);
      message.error('更新工单失败: ' + error.message);
    }
  };
  
  // 提交评论
  const handleCommentSubmit = async () => {
    if (!commentValue.trim()) {
      return;
    }
    
    setSubmittingComment(true);
    
    try {
      await api.addTicketComment(id, { content: commentValue });
      message.success('评论添加成功');
      setCommentValue('');
      fetchTicket();
    } catch (error) {
      console.error('添加评论失败:', error);
      message.error('添加评论失败: ' + error.message);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  // 检查用户是否有编辑权限
  const hasEditPermission = () => {
    if (!ticket || !currentUser) return false;
    
    return isAdmin();
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }
  
  if (!ticket) {
    return (
      <div>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/tickets')}
          style={{ marginBottom: 16 }}
        >
          返回工单列表
        </Button>
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            工单不存在或已被删除
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
          onClick={() => navigate('/tickets')}
        >
          返回工单列表
        </Button>
        
        {hasEditPermission() && (
          <Button 
            icon={<EditOutlined />} 
            onClick={showEditModal}
          >
            处理工单
          </Button>
        )}
      </div>
      
      {/* 工单详情 */}
      <Card className="work-item-detail-header">
        <div className="work-item-detail-title">
          <Title level={3}>{ticket.title}</Title>
          <Text type="secondary">工单编号: {ticket.ticketNumber}</Text>
        </div>
        
        <div className="work-item-detail-meta">
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">状态:</span>
            {renderStatusTag(ticket.status)}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">紧急程度:</span>
            {renderPriorityTag(ticket.priority)}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">创建者:</span>
            {ticket.creator ? ticket.creator.username : '-'}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">负责人:</span>
            {ticket.assignee ? ticket.assignee.username : '未分配'}
          </div>
          <div className="work-item-detail-meta-item">
            <span className="work-item-detail-meta-label">创建时间:</span>
            {new Date(ticket.createdAt).toLocaleString()}
          </div>
        </div>
      </Card>
      
      <Card title="工单描述" style={{ marginTop: 16 }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {ticket.description || '无描述'}
        </div>
      </Card>
      
      {/* 评论 */}
      <Card title="评论" style={{ marginTop: 16 }} className="work-item-detail-comments">
        {ticket.comments && ticket.comments.length > 0 ? (
          <List
            dataSource={ticket.comments}
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
      
      {/* 编辑工单模态框 */}
      <Modal
        title="处理工单"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={handleEditCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Option value="待处理">待处理</Option>
              <Option value="进行中">进行中</Option>
              <Option value="已完成">已完成</Option>
              <Option value="关闭">关闭</Option>
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
            name="comment"
            label="处理说明"
          >
            <Input.TextArea rows={4} placeholder="请输入处理说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TicketDetail; 