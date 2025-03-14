import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Badge, Modal, Button, Form, Input, Select, message } from 'antd';
import { 
  DashboardOutlined, 
  ProjectOutlined, 
  UserOutlined, 
  LogoutOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  DownOutlined,
  RadarChartOutlined,
  FileOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import styled from 'styled-components';

const { Header, Content, Footer } = Layout;
const { Option } = Select;

// 创建旋转动画组件
const RotatingIcon = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-right: 12px;
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    border: 2px solid #1890ff;
    border-radius: 50%;
    animation: rotate 3s linear infinite;
  }

  &::before {
    width: 42px;
    height: 42px;
    border-color: #1890ff transparent #1890ff transparent;
  }

  &::after {
    width: 32px;
    height: 32px;
    border-color: transparent #52c41a transparent #52c41a;
    animation-direction: reverse;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .icon {
    color: #fff;
    z-index: 1;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }
`;

const StyledHeader = styled(Header)`
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: linear-gradient(90deg, 
    rgba(24, 144, 255, 0.95) 0%,
    rgba(47, 84, 235, 0.9) 50%,
    rgba(114, 46, 209, 0.85) 100%
  );
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 1;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url('/header-bg.jpg') center/cover;
    opacity: 0.1;
    z-index: -1;
    pointer-events: none;
  }

  .logo-section {
    display: flex;
    align-items: center;
    font-size: 20px;
    font-weight: bold;
    color: #fff;
    margin-right: 48px;
  }

  .ant-menu {
    flex: 1;
    background: transparent;
    border-bottom: none;
    font-size: 16px;

    .ant-menu-item {
      color: rgba(255, 255, 255, 0.85);
      
      &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }
      
      &.ant-menu-item-selected {
        background: rgba(255, 255, 255, 0.15);
        
        &::after {
          border-bottom-color: #fff;
        }
      }
    }
  }

  .user-section {
    display: flex;
    align-items: center;
    gap: 24px;

    .notification-icon {
      font-size: 20px;
      color: #fff;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        transform: scale(1.1);
      }
    }

    .user-dropdown {
      cursor: pointer;
      color: #fff;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 8px;

      .ant-avatar {
        margin-right: 8px;
        transition: all 0.3s;

        &:hover {
          transform: scale(1.1);
        }
      }
    }
  }
`;

const MainLayout = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [ticketForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [admins, setAdmins] = useState([]);
  
  // 获取管理员列表
  const fetchAdmins = async () => {
    try {
      const data = await api.getAdmins();
      setAdmins(data);
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      message.error('获取管理员列表失败');
    }
  };
  
  // 处理登出
  const handleLogout = () => {
    logout();
    navigate('/login');
    message.success('已成功登出');
  };
  
  // 打开工单提交弹窗
  const showTicketModal = () => {
    setTicketModalVisible(true);
    fetchAdmins();
  };
  
  // 关闭工单提交弹窗
  const handleTicketCancel = () => {
    setTicketModalVisible(false);
    ticketForm.resetFields();
  };
  
  // 提交工单
  const handleTicketSubmit = async () => {
    try {
      const values = await ticketForm.validateFields();
      setSubmitting(true);
      
      const response = await api.createTicket(values);
      
      message.success('工单提交成功，工单编号: ' + response.ticket.ticketNumber);
      setTicketModalVisible(false);
      ticketForm.resetFields();
    } catch (error) {
      console.error('提交工单失败:', error);
      message.error('提交工单失败: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  // 用户下拉菜单
  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        <Link to="/profile">个人资料</Link>
      </Menu.Item>
      <Menu.Item key="ticket" icon={<QuestionCircleOutlined />} onClick={showTicketModal}>
        提交工单
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        退出登录
      </Menu.Item>
    </Menu>
  );
  
  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path.startsWith('/projects') || path.startsWith('/work-items')) return 'projects';
    
    // 对于管理员用户，所有工单相关路径都高亮"工单管理"菜单
    if ((currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && 
        (path.startsWith('/tickets') || path.startsWith('/admin/tickets'))) {
      return 'admin-tickets';
    }
    
    // 对于普通用户，工单路径高亮"我的工单"菜单
    if (path.startsWith('/tickets')) return 'tickets';
    if (path.startsWith('/admin/tickets')) return 'admin-tickets';
    
    return 'dashboard';
  };
  
  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <StyledHeader>
        <div className="logo-section">
          <RotatingIcon>
            <RadarChartOutlined className="icon" />
          </RotatingIcon>
          项目管理平台
        </div>
        <Menu 
          mode="horizontal" 
          selectedKeys={[getSelectedKey()]}
          theme="dark"
        >
          <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
            <Link to="/">概览</Link>
          </Menu.Item>
          <Menu.Item key="projects" icon={<ProjectOutlined />}>
            <Link to="/projects">项目管理</Link>
          </Menu.Item>
          {(currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') && (
            <Menu.Item key="tickets" icon={<FileOutlined />}>
              <Link to="/tickets">我的工单</Link>
            </Menu.Item>
          )}
          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
            <Menu.Item key="admin-tickets" icon={<FileTextOutlined />}>
              <Link to="/admin/tickets">工单管理</Link>
            </Menu.Item>
          )}
        </Menu>
        <div className="user-section">
          <Badge count={0}>
            <BellOutlined className="notification-icon" />
          </Badge>
          <Dropdown overlay={userMenu} trigger={['click']}>
            <span className="user-dropdown">
              <Avatar 
                src={currentUser?.avatar} 
                icon={<UserOutlined />} 
                style={{ backgroundColor: '#87d068' }} 
              />
              <span>{currentUser?.username}</span>
              <DownOutlined />
            </span>
          </Dropdown>
        </div>
      </StyledHeader>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <Outlet />
      </Content>
      <Footer style={{ textAlign: 'center', background: '#fff', padding: '12px' }}>
        项目管理平台 ©2024 Created by Your Company
      </Footer>
      
      {/* 提交工单弹窗 */}
      <Modal
        title="提交工单"
        open={ticketModalVisible}
        onCancel={handleTicketCancel}
        footer={[
          <Button key="cancel" onClick={handleTicketCancel}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={submitting} 
            onClick={handleTicketSubmit}
          >
            提交
          </Button>
        ]}
      >
        <Form
          form={ticketForm}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入工单标题' }]}
          >
            <Input placeholder="请输入工单标题" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入工单描述' }]}
          >
            <Input.TextArea rows={4} placeholder="请详细描述您的问题或需求" />
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
            name="assigneeId"
            label="负责人"
          >
            <Select placeholder="请选择负责人（可选）">
              {admins.map(admin => (
                <Option key={admin.id} value={admin.id}>
                  {admin.username} ({admin.role === 'super_admin' ? '超级管理员' : '管理员'})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default MainLayout; 