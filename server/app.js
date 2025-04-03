const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');

const app = express();

// CORS配置，允许特定来源访问
const corsOptions = {
  origin: process.env.CLIENT_URL || 'https://www.pipecode.asia',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// 中间件配置
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 简化目录创建逻辑
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// 确保上传目录存在
const publicDir = path.resolve(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const filesDir = path.join(uploadsDir, 'files');
const avatarsDir = path.join(uploadsDir, 'avatars');
const exportsDir = path.join(publicDir, 'exports');

// 创建所有必要的目录
[publicDir, uploadsDir, imagesDir, filesDir, avatarsDir, exportsDir].forEach(ensureDirectoryExists);

// 配置静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/exports', express.static(path.join(__dirname, 'public/exports')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// 路由配置
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/work-items', require('./routes/workItems'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/dashboard', require('./routes/dashboard'));

// 在所有API路由之后，添加通配符路由处理前端路由
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// 添加一个通用的错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    message: '服务器错误', 
    error: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
  });
});

module.exports = app; 