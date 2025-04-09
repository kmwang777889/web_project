import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, message, Tooltip, Badge, Popconfirm } from 'antd';
import { UserOutlined, CheckCircleOutlined, StopOutlined, EditOutlined, LockOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const { isSuperAdmin, isAdmin } = useAuth();
  
  // 加载用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.getUsers();
      setUsers(response);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 首次加载
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // 打开编辑用户对话框
  const showEditModal = (user) => {
    setCurrentUser(user);
    form.setFieldsValue({
      username: user.username,
      phone: user.phone,
      brand: user.brand,
      role: user.role,
      status: user.status
    });
    setEditModalVisible(true);
  };
  
  // 打开修改密码对话框
  const showPasswordModal = (user) => {
    setCurrentUser(user);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };
  
  // 处理用户编辑提交
  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields();
      await api.updateUser(currentUser.id, values);
      
      message.success('用户信息更新成功');
      setEditModalVisible(false);
      
      // 更新用户列表，直接刷新获取最新数据而不是本地更新
      fetchUsers();
      
    } catch (error) {
      console.error('更新用户信息失败:', error);
      message.error('更新用户信息失败: ' + error.message);
    }
  };
  
  // 处理修改密码提交
  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      await api.updatePassword(currentUser.id, values);
      
      message.success('密码修改成功');
      setPasswordModalVisible(false);
    } catch (error) {
      console.error('修改密码失败:', error);
      message.error('修改密码失败: ' + error.message);
    }
  };
  
  // 审核用户
  const approveUser = async (userId) => {
    try {
      await api.updateUser(userId, { status: 'active' });
      message.success('用户已审核通过');
      // 更新用户列表
      fetchUsers();
    } catch (error) {
      console.error('审核用户失败:', error);
      message.error('审核用户失败: ' + error.message);
    }
  };
  
  // 禁用用户
  const disableUser = async (userId) => {
    try {
      await api.updateUser(userId, { status: 'disabled' });
      message.success('用户已禁用');
      // 更新用户列表
      fetchUsers();
    } catch (error) {
      console.error('禁用用户失败:', error);
      message.error('禁用用户失败: ' + error.message);
    }
  };
  
  // 删除用户
  const deleteUser = async (userId) => {
    try {
      await api.deleteUser(userId);
      message.success('用户已删除');
      // 更新用户列表
      fetchUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error('删除用户失败: ' + error.message);
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Space>
          {text}
          {record.status === 'pending' && (
            <Badge status="processing" text="待审核" />
          )}
        </Space>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: role => {
        let color;
        let text;
        
        switch (role) {
          case 'super_admin':
            color = 'red';
            text = '超级管理员';
            break;
          case 'admin':
            color = 'gold';
            text = '管理员';
            break;
          default:
            color = 'blue';
            text = '普通用户';
        }
        
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        let color;
        let text;
        
        switch (status) {
          case 'active':
            color = 'success';
            text = '正常';
            break;
          case 'disabled':
            color = 'error';
            text = '已禁用';
            break;
          case 'pending':
            color = 'processing';
            text = '待审核';
            break;
          default:
            color = 'default';
            text = '未知';
        }
        
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: createdAt => new Date(createdAt).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'pending' && (
            <Tooltip title="审核通过">
              <Button 
                type="primary" 
                icon={<CheckCircleOutlined />} 
                size="small"
                onClick={() => approveUser(record.id)}
              />
            </Tooltip>
          )}
          
          {record.status === 'active' && (
            <Tooltip title="禁用账户">
              <Button 
                type="primary" 
                danger
                icon={<StopOutlined />} 
                size="small"
                onClick={() => disableUser(record.id)}
              />
            </Tooltip>
          )}
          
          {record.status === 'disabled' && (
            <Tooltip title="启用账户">
              <Button 
                type="primary" 
                icon={<CheckCircleOutlined />} 
                size="small"
                onClick={() => approveUser(record.id)}
              />
            </Tooltip>
          )}
          
          <Tooltip title="编辑用户">
            <Button 
              type="default" 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => showEditModal(record)}
            />
          </Tooltip>
          
          <Tooltip title="修改密码">
            <Button 
              type="default" 
              icon={<LockOutlined />} 
              size="small"
              onClick={() => showPasswordModal(record)}
            />
          </Tooltip>
          
          {isSuperAdmin() && (
            <Tooltip title="删除用户">
              <Popconfirm
                title="确定要删除此用户吗?"
                onConfirm={() => deleteUser(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  type="default" 
                  danger
                  icon={<DeleteOutlined />} 
                  size="small"
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];
  
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={fetchUsers}>刷新列表</Button>
      </div>
      
      <Table 
        columns={columns} 
        dataSource={users} 
        rowKey="id" 
        loading={loading}
        pagination={{ 
          pageSize: 10, 
          showSizeChanger: true, 
          showTotal: total => `共 ${total} 条记录` 
        }}
      />
      
      {/* 编辑用户对话框 */}
      <Modal
        title="编辑用户信息"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditSubmit}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
            ]}
          >
            <Input placeholder="手机号" />
          </Form.Item>
          
          <Form.Item
            name="brand"
            label="所属品牌"
            rules={[{ required: true, message: '请选择所属品牌' }]}
          >
            <Select placeholder="请选择所属品牌">
              <Option value="EL">EL</Option>
              <Option value="CL">CL</Option>
              <Option value="MAC">MAC</Option>
              <Option value="DA">DA</Option>
              <Option value="LAB">LAB</Option>
              <Option value="OR">OR</Option>
              <Option value="Dr.jart+">Dr.jart+</Option>
              <Option value="IT">IT</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="role"
            label="用户角色"
            rules={[{ required: true, message: '请选择用户角色' }]}
            tooltip={!isSuperAdmin() ? "只有超级管理员可以设置'超级管理员'角色" : ""}
          >
            <Select placeholder="请选择用户角色">
              <Option value="user">普通用户</Option>
              <Option value="admin">管理员</Option>
              {isSuperAdmin() && (
                <Option value="super_admin">超级管理员</Option>
              )}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="status"
            label="账户状态"
            rules={[{ required: true, message: '请选择账户状态' }]}
          >
            <Select placeholder="请选择账户状态">
              <Option value="active">正常</Option>
              <Option value="disabled">禁用</Option>
              <Option value="pending">待审核</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 修改密码对话框 */}
      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        onOk={handlePasswordSubmit}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={passwordForm}
          layout="vertical"
        >
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password placeholder="新密码" />
          </Form.Item>
          
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="确认新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement; 