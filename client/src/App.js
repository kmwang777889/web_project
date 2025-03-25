import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { setupAxiosInterceptors } from './utils/api';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import WorkItemDetail from './pages/WorkItemDetail';
import Profile from './pages/Profile';
import MainLayout from './components/MainLayout';
import NotFound from './pages/NotFound';
import WorkItemList from './pages/WorkItemList';
import AdminTicketList from './pages/AdminTicketList';
import TicketList from './pages/TicketList';
import TicketDetail from './pages/TicketDetail';
import UserManagement from './pages/UserManagement';

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setupAxiosInterceptors(navigate);
  }, [navigate]);

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return children;
};

// 公共路由组件 - 如果用户已登录，重定向到首页
const PublicRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/" />;
  }

  return children;
};

// 管理员路由组件 - 只允许管理员访问
const AdminRoute = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  if (!isAdmin()) {
    return <Navigate to="/" />;
  }
  
  return children;
};

// 工单路由组件 - 根据用户角色重定向到不同的工单页面
const TicketRoute = () => {
  const { currentUser } = useAuth();
  
  // 如果是管理员用户，重定向到工单管理页面
  if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
    return <Navigate to="/admin/tickets" />;
  }
  
  // 普通用户显示我的工单页面
  return <TicketList />;
};

// 工单详情路由组件 - 确保返回按钮指向正确的页面
const TicketDetailRoute = () => {
  const { currentUser, isAdmin } = useAuth();
  const { id } = useParams();
  
  // 使用 isAdmin() 函数替代直接判断
  return <TicketDetail 
    ticketId={id} 
    isAdmin={isAdmin()} 
  />;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } />
          
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="work-items/:id" element={<WorkItemDetail />} />
            <Route path="tickets" element={<TicketRoute />} />
            <Route path="tickets/:id" element={<TicketDetailRoute />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin/tickets" element={<AdminTicketList />} />
            <Route path="admin/users" element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            } />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App; 