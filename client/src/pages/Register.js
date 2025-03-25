import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Select, message, Spin, Alert } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, BankOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { currentUser } = useAuth();
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
      // 直接调用 API，而不是通过 auth context 来注册用户
      await api.register(values);
      setRegistered(true);
      message.success('注册成功，请等待管理员审核');
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
  
  // 如果已经注册成功，显示等待审核的消息
  if (registered) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="login-form-title">
            <Title level={2}>注册成功</Title>
          </div>
          
          <Alert
            message="账户正在审核中"
            description={
              <div>
                <p>您的账户已成功注册，但需要管理员审核通过后才能使用。</p>
                <p>请耐心等待，审核通过后我们会通知您。</p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <div>
            <Button type="primary" onClick={() => navigate('/login')}>
              返回登录
            </Button>
          </div>
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