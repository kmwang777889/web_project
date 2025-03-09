const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 确保上传目录存在
const publicDir = path.resolve(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const filesDir = path.join(uploadsDir, 'files');
const avatarsDir = path.join(uploadsDir, 'avatars');
const exportsDir = path.join(publicDir, 'exports');

// 创建目录（如果不存在）
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('创建公共目录:', publicDir);
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('创建上传根目录:', uploadsDir);
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('创建图片上传目录:', imagesDir);
}

if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
  console.log('创建文件上传目录:', filesDir);
}

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
  console.log('创建头像上传目录:', avatarsDir);
}

if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
  console.log('创建导出目录:', exportsDir);
}

// 配置静态文件服务
// 注意：这里使用绝对路径，确保路径正确
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/exports', express.static(path.join(__dirname, 'public/exports')));
// 添加一个根路径的静态服务，用于调试
app.use('/public', express.static(path.join(__dirname, 'public')));

// 添加路径调试信息
console.log('静态文件服务配置:');
console.log('- /uploads 映射到:', path.join(__dirname, 'public/uploads'));
console.log('- /exports 映射到:', path.join(__dirname, 'public/exports'));
console.log('- /public 映射到:', path.join(__dirname, 'public'));

// 列出目录中的文件，帮助调试
try {
  console.log('上传目录中的文件:');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    console.log('- 上传根目录:', files);
  }
  if (fs.existsSync(imagesDir)) {
    const imageFiles = fs.readdirSync(imagesDir);
    console.log('- 图片目录:', imageFiles);
  }
  if (fs.existsSync(filesDir)) {
    const docFiles = fs.readdirSync(filesDir);
    console.log('- 文件目录:', docFiles);
  }
} catch (readError) {
  console.error('读取上传目录失败:', readError);
}

// 添加一个测试路由，用于检查文件是否可访问
app.get('/test-uploads', (req, res) => {
  const result = {
    directories: {
      public: fs.existsSync(publicDir),
      uploads: fs.existsSync(uploadsDir),
      images: fs.existsSync(imagesDir),
      files: fs.existsSync(filesDir)
    },
    files: {}
  };
  
  // 检查上传目录中的文件
  if (fs.existsSync(uploadsDir)) {
    const uploadFiles = fs.readdirSync(uploadsDir);
    result.files.uploads = uploadFiles;
    
    if (fs.existsSync(imagesDir)) {
      const imageFiles = fs.readdirSync(imagesDir);
      result.files.images = imageFiles;
    }
    
    if (fs.existsSync(filesDir)) {
      const docFiles = fs.readdirSync(filesDir);
      result.files.files = docFiles;
    }
  }
  
  res.json(result);
});

// 添加一个文件上传测试路由
const testUpload = multer({
  dest: path.join(__dirname, 'public/uploads/test')
});

app.post('/test-upload', testUpload.single('file'), (req, res) => {
  try {
    console.log('收到测试上传请求');
    console.log('请求头:', req.headers);
    
    if (!req.file) {
      console.log('没有上传文件');
      return res.status(400).json({ message: '没有上传文件' });
    }
    
    console.log('测试上传文件:', req.file);
    
    // 确保测试目录存在
    const testDir = path.join(__dirname, 'public/uploads/test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
      console.log('创建测试目录:', testDir);
    }
    
    // 重命名文件，添加原始扩展名
    const originalName = req.file.originalname;
    const ext = path.extname(originalName);
    const newFilename = req.file.filename + ext;
    const oldPath = req.file.path;
    const newPath = path.join(testDir, newFilename);
    
    fs.renameSync(oldPath, newPath);
    console.log('文件已重命名:', oldPath, '->', newPath);
    
    // 构建访问URL
    const fileUrl = `/uploads/test/${newFilename}`;
    console.log('文件访问URL:', fileUrl);
    
    res.json({
      message: '文件上传成功',
      file: {
        originalname: originalName,
        filename: newFilename,
        path: newPath,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('测试上传错误:', error);
    res.status(500).json({ message: '上传测试失败: ' + error.message });
  }
});

// 添加请求体解析调试中间件
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      console.log(`收到 ${req.method} 请求，Content-Type: ${contentType}`);
      console.log('这是一个文件上传请求');
    }
  }
  next();
});

// 路由配置
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/work-items', require('./routes/workItems'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/dashboard', require('./routes/dashboard'));

// 添加一个通用的错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    message: '服务器错误', 
    error: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
  });
});

module.exports = app; 