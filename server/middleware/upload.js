const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在 - 使用绝对路径
const publicDir = path.resolve(__dirname, '../public');
const uploadsDir = path.join(publicDir, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const filesDir = path.join(uploadsDir, 'files');

console.log('上传目录绝对路径:');
console.log('- 公共目录:', publicDir);
console.log('- 上传根目录:', uploadsDir);
console.log('- 图片目录:', imagesDir);
console.log('- 文件目录:', filesDir);

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

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('multer destination 被调用，文件:', file.originalname);
    
    // 根据文件类型选择不同的目录
    const isImage = file.mimetype.startsWith('image/');
    const uploadDir = isImage ? imagesDir : filesDir;
    console.log(`文件 ${file.originalname} 将保存到:`, uploadDir);
    
    // 确保目录存在
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`创建目录: ${uploadDir}`);
      } catch (error) {
        console.error(`创建目录失败: ${uploadDir}`, error);
      }
    }
    
    // 检查目录是否可写
    try {
      fs.accessSync(uploadDir, fs.constants.W_OK);
      console.log(`目录 ${uploadDir} 可写`);
    } catch (error) {
      console.error(`目录 ${uploadDir} 不可写:`, error);
      // 尝试修复权限
      try {
        fs.chmodSync(uploadDir, 0o777);
        console.log(`已修改目录 ${uploadDir} 权限为777`);
      } catch (chmodError) {
        console.error(`修改目录权限失败:`, chmodError);
      }
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    console.log('multer filename 被调用，文件:', file.originalname);
    
    // 处理原始文件名，确保中文文件名正确编码
    let originalName;
    try {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (error) {
      console.error('文件名编码转换失败:', error);
      originalName = file.originalname;
    }
    
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalName);
    const filename = uniqueSuffix + ext;
    console.log(`文件 ${originalName} 将重命名为:`, filename);
    
    // 保存原始文件名和路径信息到请求对象，以便后续使用
    if (!req.fileInfo) {
      req.fileInfo = {};
    }
    
    const isImage = file.mimetype.startsWith('image/');
    const subDir = isImage ? 'images' : 'files';
    const relativePath = `/uploads/${subDir}/${filename}`;
    
    req.fileInfo[filename] = {
      originalName,
      relativePath,
      mimetype: file.mimetype
    };
    
    console.log(`文件 ${originalName} 的访问路径将为:`, relativePath);
    
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  console.log('multer fileFilter 被调用，文件:', file.originalname, file.mimetype);
  
  // 允许的文件类型
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedFileTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // 添加更多常见文件类型
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/octet-stream'
  ];
  
  if (allowedImageTypes.includes(file.mimetype) || allowedFileTypes.includes(file.mimetype)) {
    console.log('文件类型有效:', file.mimetype);
    cb(null, true);
  } else {
    console.log('不支持的文件类型:', file.mimetype);
    // 允许所有文件类型，但记录警告
    console.warn('允许未知文件类型上传:', file.mimetype);
    cb(null, true);
  }
};

// 创建 multer 实例
const upload = multer({
  storage: storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  }
});

// 处理上传错误
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer 错误:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小不能超过20MB' });
    }
    return res.status(400).json({ success: false, message: '文件上传失败: ' + err.message });
  } else if (err) {
    console.error('文件上传错误:', err);
    return res.status(500).json({ success: false, message: '服务器错误: ' + err.message });
  }
  next();
};

// 添加一个中间件来检查请求中是否包含文件
const logUploadRequest = (req, res, next) => {
  console.log('收到上传请求:');
  console.log('- 请求方法:', req.method);
  console.log('- 请求路径:', req.path);
  console.log('- Content-Type:', req.headers['content-type']);
  
  // 保存原始请求体，用于调试
  let rawBody = '';
  req.on('data', chunk => {
    rawBody += chunk.toString();
    if (rawBody.length > 1000) {
      rawBody = rawBody.substring(0, 1000) + '... [截断]';
    }
  });
  
  req.on('end', () => {
    req.rawBody = rawBody;
    console.log('- 原始请求体长度:', rawBody.length);
    if (rawBody.length < 1000) {
      console.log('- 原始请求体:', rawBody);
    }
  });
  
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    console.log('- 这是一个文件上传请求');
    
    // 检查请求体中是否包含文件
    if (req.is('multipart/form-data')) {
      console.log('- 请求体是 multipart/form-data 格式');
    } else {
      console.warn('- 警告: 请求体不是 multipart/form-data 格式');
    }
  } else {
    console.log('- 这不是一个文件上传请求');
  }
  
  next();
};

module.exports = { upload, handleUploadError, logUploadRequest }; 