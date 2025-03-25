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
  FileTextOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
// 导入样式组件
import { RotatingIcon, StyledHeader } from './MainLayoutStyles';

const { Content, Footer } = Layout;
const { Option } = Select;

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
    
    // 对于用户管理页面
    if (path.startsWith('/admin/users')) return 'admin-users';
    
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
          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
            <Menu.Item key="admin-users" icon={<TeamOutlined />}>
              <Link to="/admin/users">用户管理</Link>
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
        项目管理平台 ©2024 Created by Samuel | <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">皖ICP备2025079298号</a>
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