import React, { useState } from 'react';
import { Form, Input, Button, Typography, message, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // 处理登录表单提交
  const handleSubmit = async (values) => {
    const { username, password } = values;
    
    setLoading(true);
    console.log('尝试登录:', username);
    
    try {
      const user = await login(username, password);
      if (user) {
        message.success('登录成功');
        navigate('/');
      }
      // 登录失败的情况已在 AuthContext 中处理
    } catch (error) {
      console.error('登录失败:', error);
      
      if (error.status === 401) {
        message.error('用户名或密码错误');
      } else if (error.message.includes('pending')) {
        message.error('您的账户正在审核中，请稍后再试');
      } else if (error.message.includes('disabled')) {
        message.error('您的账户已被禁用，请联系管理员');
      } else {
        message.error('登录失败: ' + error.message);
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