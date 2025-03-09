import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// 创建 axios 实例
const instance = axios.create({
  baseURL,
  timeout: 10000
});

// 设置拦截器函数
export const setupAxiosInterceptors = (navigate) => {
  // 请求拦截器
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      console.error('请求拦截器错误:', error);
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  instance.interceptors.response.use(
    (response) => {
      // 确保返回完整的response对象
      return response;
    },
    (error) => {
      console.error('响应拦截器错误:', error);
      
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (navigate) {
          navigate('/login');
        } else {
          window.location.href = '/login';
        }
      }
      
      // 返回一个带有错误信息的对象，而不是直接抛出错误
      return Promise.reject({
        message: error.response?.data?.message || error.message || '未知错误',
        status: error.response?.status,
        data: error.response?.data
      });
    }
  );
};

// 初始化拦截器
setupAxiosInterceptors();

// 通用API请求函数
export const apiRequest = async (method, url, data = null, config = {}) => {
  try {
    console.log(`发起API请求: ${method.toUpperCase()} ${url}`, config);
    const response = await instance({
      method,
      url,
      data,
      ...config
    });
    
    console.log(`API响应: ${method.toUpperCase()} ${url}`, response);
    
    // 如果response不存在，返回空对象
    if (!response) {
      console.warn(`API响应为空: ${method.toUpperCase()} ${url}`);
      return {};
    }
    
    // 如果response.data存在，返回它；否则返回response本身
    return response.data !== undefined ? response.data : response;
  } catch (error) {
    console.error(`API请求错误 [${method.toUpperCase()} ${url}]:`, error);
    
    if (error.response) {
      // 服务器响应了错误状态码
      const errorMessage = error.response.data?.message || '请求失败';
      throw new Error(errorMessage);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      throw new Error('无法连接到服务器，请检查网络连接');
    } else {
      // 请求设置时发生错误
      throw new Error('请求错误: ' + (error.message || '未知错误'));
    }
  }
};

// 文件上传请求
export const uploadFile = async (url, formData, config = {}) => {
  try {
    const response = await instance.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      ...config
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response.data.message || '上传失败';
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('无法连接到服务器，请检查网络连接');
    } else {
      throw new Error('上传错误: ' + error.message);
    }
  }
};

// 导出API函数
export default {
  // 认证相关
  login: (data) => apiRequest('post', '/auth/login', data),
  register: (data) => apiRequest('post', '/auth/register', data),
  getCurrentUser: () => apiRequest('get', '/auth/me'),
  
  // 用户相关
  getUsers: () => apiRequest('get', '/users'),
  getAdmins: () => apiRequest('get', '/users/admins'),
  getUserById: (id) => apiRequest('get', `/users/${id}`),
  updateUser: (id, data) => apiRequest('put', `/users/${id}`, data),
  updatePassword: (id, data) => apiRequest('put', `/users/${id}/password`, data),
  uploadAvatar: (id, formData) => uploadFile(`/users/${id}`, formData),
  
  // 项目相关
  getProjects: (params) => {
    console.log('调用 getProjects API, 参数:', params);
    return instance.get('/projects', { params })
      .then(response => {
        console.log('getProjects API 原始响应:', response);
        // 确保返回的是数组，如果不是则返回空数组
        if (!response) {
          console.warn('getProjects API 响应为空');
          return [];
        }
        
        const data = response.data;
        console.log('getProjects API 处理后数据:', data);
        return Array.isArray(data) ? data : [];
      })
      .catch(error => {
        console.error('getProjects API 错误:', error);
        // 返回空数组而不是抛出错误，这样组件可以继续渲染
        return [];
      });
  },
  createProject: (data) => apiRequest('post', '/projects', data),
  getProjectById: (id) => apiRequest('get', `/projects/${id}`),
  updateProject: (id, data) => apiRequest('put', `/projects/${id}`, data),
  deleteProject: (id) => apiRequest('delete', `/projects/${id}`),
  exportProject: (id) => apiRequest('get', `/projects/${id}/export`),
  
  // 工作项相关
  getWorkItems: (params) => {
    console.log('调用 getWorkItems API, 参数:', params);
    return instance.get('/work-items', { params })
      .then(response => {
        console.log('getWorkItems API 原始响应:', response);
        if (!response) {
          console.warn('getWorkItems API 响应为空');
          return [];
        }
        
        const data = response.data;
        return Array.isArray(data) ? data : [];
      })
      .catch(error => {
        console.error('getWorkItems API 错误:', error);
        return [];
      });
  },
  getPendingScheduleItems: () => {
    return instance.get('/work-items/pending-schedule')
      .then(response => {
        if (!response) return [];
        const data = response.data;
        return Array.isArray(data) ? data : [];
      })
      .catch(error => {
        console.error('getPendingScheduleItems API 错误:', error);
        return [];
      });
  },
  createWorkItem: (data) => apiRequest('post', '/work-items', data),
  getWorkItemById: (id) => apiRequest('get', `/work-items/${id}`),
  updateWorkItem: async (id, data) => {
    console.log(`准备更新工作项 ID: ${id}`);
    
    let requestData;
    // 检查是否已经是 FormData 实例
    if (data instanceof FormData) {
      requestData = data;
    } else {
      // 如果是普通对象，转换为 FormData
      requestData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          requestData.append(key, value);
        }
      });
    }
    
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      };
      
      console.log('发送请求头:', headers);
      
      const response = await axios.put(`/work-items/${id}`, requestData, {
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      console.log('更新工作项响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('API 更新工作项错误:', error);
      console.error('错误响应:', error.response ? error.response.data : '无响应数据');
      throw error;
    }
  },
  deleteWorkItem: (id) => apiRequest('delete', `/work-items/${id}`),
  addWorkItemComment: (id, data) => apiRequest('post', `/work-items/${id}/comments`, data),
  deleteWorkItemAttachment: (id, attachmentId) => apiRequest('delete', `/work-items/${id}/attachments/${attachmentId}`),
  exportWorkItems: (params) => apiRequest('get', '/work-items/export', null, { params }),
  
  // 下载文件辅助函数
  downloadFile: (url, filename) => {
    const fullUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${url}`;
    const link = document.createElement('a');
    link.href = fullUrl;
    link.setAttribute('download', filename || '下载文件');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  
  // 工单相关
  getTickets: (params) => apiRequest('get', '/tickets', null, { params }),
  createTicket: (data) => apiRequest('post', '/tickets', data),
  getTicketById: (id) => apiRequest('get', `/tickets/${id}`),
  updateTicket: (id, data) => apiRequest('put', `/tickets/${id}`, data),
  addTicketComment: (id, data) => apiRequest('post', `/tickets/${id}/comments`, data),
  
  // 仪表盘相关
  getDashboardStats: () => {
    return instance.get('/dashboard/stats')
      .then(response => {
        if (!response) return { completedCount: 0, pendingCount: 0, dailyAverage: 0 };
        return response.data || { completedCount: 0, pendingCount: 0, dailyAverage: 0 };
      })
      .catch(error => {
        console.error('getDashboardStats API 错误:', error);
        return { completedCount: 0, pendingCount: 0, dailyAverage: 0 };
      });
  },
  
  getPendingItems: (params) => {
    return instance.get('/dashboard/pending-items', { params })
      .then(response => {
        if (!response) return [];
        const data = response.data;
        return Array.isArray(data) ? data : [];
      })
      .catch(error => {
        console.error('getPendingItems API 错误:', error);
        return [];
      });
  },
  
  getGanttData: (params) => {
    return instance.get('/dashboard/gantt', { params })
      .then(response => {
        if (!response) return { ganttData: [], projects: [] };
        return response.data || { ganttData: [], projects: [] };
      })
      .catch(error => {
        console.error('getGanttData API 错误:', error);
        return { ganttData: [], projects: [] };
      });
  },

  setupAxiosInterceptors,
}; 