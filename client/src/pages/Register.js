import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Select, message, Spin, Alert } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, BankOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { register, currentUser } = useAuth();
  const navigate = useNavigate();
  
  // 如果用户已登录，重定向到首页
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);
  
  // 处理注册表单提交
  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      const user = await register(values);
      message.success('注册成功，请等待管理员审核后方可登录');
      setRegistered(true);
      // 不再自动导航到首页，而是显示等待审核的消息
    } catch (error) {
      console.error('注册失败:', error);
      if (error.response && error.response.data) {
        message.error('注册失败: ' + (error.response.data.message || '请检查您的输入'));
      } else {
        message.error('注册失败: ' + (error.message || '请稍后再试'));
      }
    } finally {
      setLoading(false);
    }
  };
  
  // 如果已注册但尚未审核，显示等待审核的消息
  if (registered) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="login-form-title">
            <Title level={2}>注册成功</Title>
          </div>
          <Alert
            message="注册申请已提交"
            description="您的账号注册申请已成功提交，请等待管理员审核。审核通过后您将收到通知，然后可以登录系统。"
            type="success"
            showIcon
            style={{ marginBottom: 20 }}
          />
          <Button type="primary" onClick={() => navigate('/login')}>
            返回登录页
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-form-title">
          <Title level={2}>项目管理系统</Title>
          <Text type="secondary">创建新账户</Text>
        </div>
        
        <Alert
          message="用户审核制度"
          description="注册成功后，您的账号需要经过管理员审核才能使用系统功能。请填写真实信息，以便管理员及时审核。"
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />
        
        <Spin spinning={loading}>
          <Form
            name="register_form"
            initialValues={{ brand: 'EL' }}
            onFinish={handleSubmit}
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input 
                prefix={<UserOutlined />} 
                placeholder="用户名" 
              />
            </Form.Item>
            
            <Form.Item
              name="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
              ]}
            >
              <Input 
                prefix={<PhoneOutlined />} 
                placeholder="手机号" 
              />
            </Form.Item>
            
            <Form.Item
              name="brand"
              rules={[{ required: true, message: '请选择所属品牌' }]}
            >
              <Select placeholder="请选择所属品牌" prefix={<BankOutlined />}>
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
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="密码" 
              />
            </Form.Item>
            
            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
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
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="确认密码" 
              />
            </Form.Item>
            
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                className="login-form-button"
                loading={loading}
              >
                注册
              </Button>
            </Form.Item>
          </Form>
        </Spin>
        
        <div className="register-link">
          <Text>已有账户？</Text> <Link to="/login">立即登录</Link>
        </div>
      </div>
    </div>
  );
};

export default Register; 