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
      console.log('使用FormData发送请求');
    } else {
      // 如果是普通对象，转换为 FormData
      requestData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          requestData.append(key, value);
        }
      });
      console.log('将普通对象转换为FormData');
    }
    
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        // 不要手动设置Content-Type，让浏览器自动设置multipart/form-data和boundary
      };
      
      console.log('发送请求头:', headers);
      
      const response = await axios.put(`${baseURL}/work-items/${id}`, requestData, {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      console.log('更新工作项响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('更新工作项失败:', error);
      throw error;
    }
  },
  deleteWorkItem: (id) => apiRequest('delete', `/work-items/${id}`),
  addWorkItemComment: (id, data) => apiRequest('post', `/work-items/${id}/comments`, data),
  deleteWorkItemAttachment: (id, attachmentId) => apiRequest('delete', `/work-items/${id}/attachments/${attachmentId}`),
  exportWorkItems: (params) => apiRequest('get', '/work-items/export', null, { params }),
  getWorkItemActivities: (id) => apiRequest('get', `/work-items/${id}/activities`),
  
  // 测试文件上传
  testUploadFile: async (file) => {
    try {
      console.log('开始上传文件:', file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      // 添加随机参数，避免缓存
      const timestamp = new Date().getTime();
      
      const response = await axios.post(`${baseURL}/work-items/test-upload-simple?t=${timestamp}`, formData, {
        headers: {
          // 不要手动设置Content-Type，让浏览器自动设置multipart/form-data和boundary
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      console.log('文件上传响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('文件上传失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '文件上传失败';
      
      if (error.response) {
        // 服务器响应了错误状态码
        errorMessage += ': ' + (error.response.data?.message || error.response.statusText || '服务器错误');
      } else if (error.request) {
        // 请求已发送但没有收到响应
        errorMessage += ': 无法连接到服务器，请检查网络连接';
      } else {
        // 请求设置时发生错误
        errorMessage += ': ' + (error.message || '未知错误');
      }
      
      throw new Error(errorMessage);
    }
  },
  
  // 下载文件辅助函数
  downloadFile: (url, filename) => {
    try {
      console.log('开始下载文件:', { url, filename });
      
      // 确保URL以/开头
      if (!url.startsWith('/')) {
        url = '/' + url;
      }
      
      // 构建完整URL
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const fullUrl = `${apiUrl}${url}`;
      console.log('完整下载URL:', fullUrl);
      
      // 使用fetch API下载文件
      fetch(fullUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`下载失败: ${response.status} ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          // 创建Blob URL
          const blobUrl = window.URL.createObjectURL(blob);
          
          // 创建一个隐藏的a标签用于下载
          const link = document.createElement('a');
          link.href = blobUrl;
          link.setAttribute('download', filename || '下载文件');
          
          // 添加到DOM并触发点击
          document.body.appendChild(link);
          console.log('触发下载链接点击');
          link.click();
          
          // 清理DOM和Blob URL
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            console.log('下载链接已从DOM中移除，Blob URL已释放');
          }, 100);
        })
        .catch(error => {
          console.error('下载文件失败:', error);
          // 显示错误消息
          const { message } = require('antd');
          message.error(`下载失败: ${error.message}`);
        });
    } catch (error) {
      console.error('下载文件函数错误:', error);
      const { message } = require('antd');
      message.error(`下载过程出错: ${error.message}`);
    }
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