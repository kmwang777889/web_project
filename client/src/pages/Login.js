import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, message, Spin, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiStatus, setApiStatus] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // 在组件加载时检查API状态
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        setApiStatus({ checking: true });
        // 尝试ping API
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

        console.log('正在检查API状态:', apiUrl);
        
        const response = await axios.get(`${apiUrl}/auth/ping`, { 
          timeout: 5000,
          withCredentials: true
        });
        
        if (response.status === 200) {
          setApiStatus({ available: true, url: apiUrl });
          console.log('API状态检查成功');
        } else {
          setApiStatus({ available: false, error: `服务器返回: ${response.status}` });
          console.log('API状态检查失败:', response.status);
        }
      } catch (error) {
        console.error('API状态检查错误:', error);
        setApiStatus({ 
          available: false, 
          error: error.message, 
          isNetwork: error.message.includes('Network Error')
        });
      }
    };
    
    checkApiStatus();
  }, []);
  
  // 处理登录表单提交
  const handleSubmit = async (values) => {
    const { username, password } = values;
    
    setLoading(true);
    setErrorMessage('');
    console.log('尝试登录:', username, '环境API地址:', process.env.REACT_APP_API_URL);
    
    try {
      const user = await login(username, password);
      if (user) {
        message.success('登录成功');
        navigate('/');
      }
      // 登录失败的情况已在 AuthContext 中处理
    } catch (error) {
      console.error('登录失败:', error);
      
      // 显示更详细的错误信息
      if (error && error.response && error.response.status === 401) {
        setErrorMessage('用户名或密码错误');
        message.error('用户名或密码错误');
      } else if (error && error.status === 401) {
        setErrorMessage('用户名或密码错误');
        message.error('用户名或密码错误');
      } else if (error && error.message && error.message.includes('pending')) {
        setErrorMessage('您的账户正在审核中，请稍后再试');
        message.error('您的账户正在审核中，请稍后再试');
      } else if (error && error.message && error.message.includes('disabled')) {
        setErrorMessage('您的账户已被禁用，请联系管理员');
        message.error('您的账户已被禁用，请联系管理员');
      } else if (error && error.message && error.message.includes('network')) {
        setErrorMessage('网络错误，请检查您的网络连接或服务器状态');
        message.error('网络错误，请检查您的网络连接或服务器状态');
      } else if (error && error.message && error.message.includes('Network Error')) {
        setErrorMessage(`网络连接失败: 无法连接到API服务器 (${process.env.REACT_APP_API_URL || 'https://api.pipecode.asia/api'})`);
        message.error('无法连接到服务器，请检查网络设置或联系管理员');
      } else {
        // 通用错误处理
        const errorMsg = error && error.message ? error.message : '未知错误';
        setErrorMessage('登录失败: ' + errorMsg);
        message.error('登录失败: ' + errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // 添加API状态指示器
  const renderApiStatus = () => {
    if (!apiStatus) return null;
    
    if (apiStatus.checking) {
      return <Alert message="正在检查服务器连接..." type="info" showIcon style={{ marginBottom: 16 }} />;
    }
    
    if (apiStatus.available) {
      return <Alert message={`服务器连接正常: ${apiStatus.url}`} type="success" showIcon style={{ marginBottom: 16 }} />;
    }
    
    return (
      <Alert
        message="服务器连接问题"
        description={
          apiStatus.isNetwork 
            ? `无法连接到API服务器 (${process.env.REACT_APP_API_URL})。请检查:
              1. 您的网络连接是否正常
              2. 服务器是否在运行
              3. 是否存在SSL证书问题
              4. 域名是否正确解析`
            : `API服务器错误: ${apiStatus.error}`
        }
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
      />
    );
  };
  
  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-form-title">
          <Title level={2}>项目管理系统</Title>
          <Text type="secondary">登录您的账户</Text>
        </div>
        
        {renderApiStatus()}
        
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
            
            {errorMessage && (
              <div className="login-error-message" style={{ color: 'red', marginBottom: '15px' }}>
                {errorMessage}
              </div>
            )}
            
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                className="login-form-button"
                loading={loading}
                disabled={apiStatus && !apiStatus.available && !loading}
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