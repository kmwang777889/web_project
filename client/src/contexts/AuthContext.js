import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import jwtDecode from 'jwt-decode';
import { message } from 'antd';

// 创建认证上下文
const AuthContext = createContext();

// 自定义钩子，方便在组件中使用认证上下文
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 初始化时从本地存储加载用户信息
  useEffect(() => {
    const loadUser = async () => {
      console.log('正在加载用户信息...');
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          // 验证令牌是否过期
          const decoded = jwtDecode(token);
          const currentTime = Date.now() / 1000;
          
          if (decoded.exp < currentTime) {
            console.log('令牌已过期，清除本地存储');
            localStorage.removeItem('token');
            setCurrentUser(null);
          } else {
            // 从服务器获取最新的用户信息
            try {
              console.log('正在从服务器获取用户信息...');
              const response = await api.getCurrentUser();
              console.log('服务器响应:', response);
              const user = response.user;
              
              // 检查用户状态
              if (user.status === 'pending') {
                message.error('您的账户正在审核中，请稍后再试');
                localStorage.removeItem('token');
                setCurrentUser(null);
              } else if (user.status === 'disabled') {
                message.error('您的账户已被禁用，请联系管理员');
                localStorage.removeItem('token');
                setCurrentUser(null);
              } else {
                setCurrentUser(user);
                console.log('成功加载用户信息:', user);
              }
            } catch (apiError) {
              console.error('获取用户信息失败:', apiError);
              // 详细记录错误
              if (apiError.response) {
                console.error('服务器响应状态:', apiError.response.status);
                console.error('服务器响应数据:', apiError.response.data);
              }
              localStorage.removeItem('token');
              setCurrentUser(null);
            }
          }
        } catch (error) {
          console.error('解析令牌失败:', error);
          localStorage.removeItem('token');
          setCurrentUser(null);
        }
      } else {
        console.log('本地存储中没有令牌');
      }
      
      setLoading(false);
    };
    
    loadUser();
  }, []);
  
  // 处理认证响应的通用函数
  const handleAuthResponse = (response) => {
    const { token, user } = response;
    
    // 检查用户状态
    if (user.status === 'pending') {
      message.error('您的账户正在审核中，请稍后再试');
      return null;
    } else if (user.status === 'disabled') {
      message.error('您的账户已被禁用，请联系管理员');
      return null;
    }
    
    localStorage.setItem('token', token);
    setCurrentUser(user);
    return user;
  };
  
  // 登录函数
  const login = async (email, password) => {
    try {
      console.log('尝试登录用户:', email);
      const response = await api.login({ email, password });
      console.log('登录响应:', response);
      
      // 检查用户状态
      const user = response.user;
      if (user.status === 'pending') {
        message.error('您的账户正在审核中，请稍后再试');
        return null;
      } else if (user.status === 'disabled') {
        message.error('您的账户已被禁用，请联系管理员');
        return null;
      }
      
      return handleAuthResponse(response);
    } catch (error) {
      console.error('登录错误:', error);
      // 详细记录错误
      if (error && error.response) {
        console.error('服务器响应状态:', error.response.status);
        console.error('服务器响应数据:', error.response.data);
        
        // 将错误对象扩展，添加状态码到主错误对象
        error.status = error.response.status;
      }
      throw error;
    }
  };
  
  // 注册函数 - 保留但不再自动登录
  const register = async (userData) => {
    try {
      const response = await api.register(userData);
      return response;
    } catch (error) {
      throw error;
    }
  };
  
  // 登出函数
  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };
  
  // 更新用户信息
  const updateUserInfo = (updatedUser) => {
    setCurrentUser(updatedUser);
  };
  
  // 检查用户是否为管理员
  const isAdmin = () => {
    return currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin');
  };
  
  // 检查用户是否为超级管理员
  const isSuperAdmin = () => {
    return currentUser && currentUser.role === 'super_admin';
  };
  
  // 提供的上下文值
  const value = {
    currentUser,
    loading,
    login,
    register,
    logout,
    updateUserInfo,
    isAdmin,
    isSuperAdmin
  };
  
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 