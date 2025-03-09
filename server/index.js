// 禁用弃用警告
process.noDeprecation = true;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sequelize, initializeDatabase } = require('./config/database');
const http = require('http');

// 导入路由
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const workItemRoutes = require('./routes/workItems');
const userRoutes = require('./routes/users');
const ticketRoutes = require('./routes/tickets');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/exports', express.static(path.join(__dirname, 'public/exports')));

// 添加路径调试信息
console.log('静态文件目录 - uploads:', path.join(__dirname, 'uploads'));
console.log('静态文件目录 - exports:', path.join(__dirname, 'public/exports'));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/work-items', workItemRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器错误', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// 创建HTTP服务器
const server = http.createServer(app);

// 启动服务器函数
async function startServer() {
  try {
    console.log('正在启动服务器...');
    
    // 首先初始化数据库
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('数据库初始化失败，服务器无法启动');
      process.exit(1);
    }
    
    // 同步数据库模型
    console.log('正在同步数据库模型...');
    await sequelize.sync();
    console.log('数据库模型同步成功');
    
    // 启动 Express 服务器
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer(); 