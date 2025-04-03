import axios from 'axios';

// 修改baseURL的定义，手动添加/api后缀
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const baseURL = `${apiUrl}/api`;

// 创建 axios 实例
const instance = axios.create({
  baseURL,
  timeout: 15000, // 增加超时时间到15秒
  withCredentials: true // 添加这一行，确保跨域请求发送凭证
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
      console.log('发送请求到:', config.url, '环境API地址:', baseURL);
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
      
      // 详细记录错误信息
      if (error.response) {
        console.error('服务器响应:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('未收到响应，请求配置:', error.request._currentUrl);
        console.error('请求方法:', error.config?.method);
        console.error('请求头:', error.config?.headers);
        console.error('是否为HTTPS:', error.config?.url?.startsWith('https'));
      } else {
        console.error('请求配置错误:', error.message);
      }
      
      // 对于401错误，如果是登录请求，不要自动重定向
      // 这样可以让登录组件自己处理错误
      if (error.response?.status === 401 && error.config && error.config.url && !error.config.url.includes('/auth/login')) {
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
        data: error.response?.data,
        response: error.response // 添加完整的响应对象
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
    
    // 添加重试逻辑
    let retries = 0;
    const maxRetries = 2;
    let response;
    
    while (retries <= maxRetries) {
      try {
        response = await instance({
          method,
          url,
          data,
          ...config
        });
        break; // 如果请求成功，跳出循环
      } catch (retryError) {
        if (retries === maxRetries || (retryError.response && retryError.response.status !== 0)) {
          // 如果已达到最大重试次数或错误不是网络错误，则抛出错误
          throw retryError;
        }
        console.log(`请求失败，第${retries + 1}次重试...`);
        retries++;
        // 等待一段时间再重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
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
    
    // 创建一个标准化的错误对象
    let errorObj;
    
    if (error && error.response) {
      // 服务器响应了错误状态码
      const errorMessage = error.response.data?.message || '请求失败';
      errorObj = new Error(errorMessage);
      errorObj.response = error.response;
      errorObj.status = error.response.status;
    } else if (error && error.request) {
      // 请求已发送但没有收到响应
      errorObj = new Error('无法连接到服务器，请检查网络连接');
      errorObj.isNetwork = true;
    } else {
      // 请求设置时发生错误
      errorObj = new Error('请求错误: ' + (error && error.message ? error.message : '未知错误'));
    }
    
    throw errorObj;
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
  approveUser: (id) => apiRequest('put', `/users/${id}/approve`, { status: 'active' }),
  disableUser: (id) => apiRequest('put', `/users/${id}/disable`, { status: 'disabled' }),
  
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
  
  // 上传附件文件
  uploadAttachmentFile: async (file) => {
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
      
      // 获取认证令牌
      const token = localStorage.getItem('token');
      
      let fullUrl;
      
      // 检查是否为绝对URL（以http://或https://开头）
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // 如果是完整URL，直接使用
        fullUrl = url;
        console.log('使用提供的完整URL:', fullUrl);
      } else {
        // 处理相对URL
        // 确保URL以/开头
        if (!url.startsWith('/')) {
          url = '/' + url;
        }
        
        // 构建完整URL
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        
        // 检查URL中是否有/api重复的情况
        if (url.startsWith('/api/') && apiUrl.endsWith('/api')) {
          // 如果传入的url已包含/api前缀，并且apiUrl也以/api结尾，则去掉url中的/api
          const urlWithoutApi = url.substring(4); // 移除开头的'/api'
          fullUrl = `${apiUrl}${urlWithoutApi}`;
        } else {
          fullUrl = `${apiUrl}${url}`;
        }
      }
      
      console.log('完整下载URL:', fullUrl);
      
      // 使用fetch API下载文件，添加认证头
      fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        credentials: 'include' // 包含cookie等凭证
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`下载失败: ${response.status}`);
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
          // 加载antd消息组件
          import('antd').then(({ message }) => {
            message.error(`下载文件失败: ${error.message}`);
          });
        });
    } catch (error) {
      console.error('下载文件函数错误:', error);
      // 加载antd消息组件
      import('antd').then(({ message }) => {
        message.error(`下载过程出错: ${error.message}`);
      });
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