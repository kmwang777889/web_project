import React, { useState } from 'react';
import { Form, Input, Button, Typography, message, Spin, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginStatus, setLoginStatus] = useState(''); // pending, rejected 或空
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // 处理登录表单提交
  const handleSubmit = async (values) => {
    const { username, password } = values;
    
    setLoading(true);
    setLoginError('');
    setLoginStatus('');
    console.log('尝试登录:', username);
    
    try {
      await login(username, password);
      message.success('登录成功');
      navigate('/');
    } catch (error) {
      console.error('登录失败:', error);
      
      // 检查是否是审核状态相关的错误
      if (error.message && error.message.includes('正在审核中')) {
        setLoginStatus('pending');
      } else if (error.message && error.message.includes('申请被拒绝')) {
        setLoginStatus('rejected');
      } else {
        setLoginError(error.message || '用户名或密码错误');
        message.error('登录失败: ' + (error.message || '用户名或密码错误'));
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-form-title">
          <Title level={2}>项目管理系统</Title>
          <Text type="secondary">登录您的账户</Text>
        </div>
        
        {loginStatus === 'pending' && (
          <Alert
            message="账号审核中"
            description="您的账号正在审核中，请等待管理员审核通过后再尝试登录。"
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}
        
        {loginStatus === 'rejected' && (
          <Alert
            message="账号审核被拒绝"
            description="很遗憾，您的账号申请被拒绝。如有疑问，请联系管理员。"
            type="error"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}
        
        {loginError && !loginStatus && (
          <Alert
            message="登录失败"
            description={loginError}
            type="error"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}
        
        <Spin spinning={loading}>
          <Form
            name="login_form"
            initialValues={{ remember: true }}
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
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="密码" 
              />
            </Form.Item>
            
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                className="login-form-button"
                loading={loading}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </Spin>
        
        <div className="register-link">
          <Text>还没有账户？</Text> <Link to="/register">立即注册</Link>
        </div>
      </div>
    </div>
  );
};

export default Login; 