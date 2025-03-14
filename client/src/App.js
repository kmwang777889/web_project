import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setupAxiosInterceptors(navigate);
  }, [navigate]);

  useEffect(() => {
    console.log('ProtectedRoute - 认证状态:', { currentUser, loading });
  }, [currentUser, loading]);

  if (!currentUser) {
    console.log('用户未登录，重定向到登录页面');
    return <Navigate to="/login" />;
  }

  return children;
};

// 公共路由组件 - 如果用户已登录，重定向到首页
const PublicRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (currentUser) {
    console.log('用户已登录，重定向到首页');
    return <Navigate to="/" />;
  }

  return children;
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
            <Route path="tickets" element={<TicketList />} />
            <Route path="tickets/:id" element={<TicketDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin/tickets" element={<AdminTicketList />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App; 