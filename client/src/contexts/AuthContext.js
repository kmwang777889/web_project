import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import jwtDecode from 'jwt-decode';

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
              const response = await api.getCurrentUser();
              setCurrentUser(response.user);
              console.log('成功加载用户信息:', response.user);
            } catch (apiError) {
              console.error('获取用户信息失败:', apiError);
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
    
    // 如果有token（登录成功），则保存用户信息
    if (token) {
      localStorage.setItem('token', token);
      setCurrentUser(user);
    }
    
    return user;
  };
  
  // 登录函数
  const login = async (username, password) => {
    try {
      const response = await api.login({ username, password });
      return handleAuthResponse(response);
    } catch (error) {
      throw error;
    }
  };
  
  // 注册函数
  const register = async (userData) => {
    try {
      const response = await api.register(userData);
      // 注册后不再自动登录，只返回注册结果
      return response.user;
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
  
  // 检查用户是否已审核通过
  const isApproved = () => {
    return currentUser && currentUser.status === 'approved';
  };
  
  // 获取待审核用户列表（仅管理员可用）
  const getPendingUsers = async () => {
    try {
      const response = await api.getPendingUsers();
      return response.users;
    } catch (error) {
      throw error;
    }
  };
  
  // 审核用户（仅管理员可用）
  const approveUser = async (userId, status, reason) => {
    try {
      const response = await api.approveUser(userId, { status, reason });
      return response;
    } catch (error) {
      throw error;
    }
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
    isSuperAdmin,
    isApproved,
    getPendingUsers,
    approveUser
  };
  
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 