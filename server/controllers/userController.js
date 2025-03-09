const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/avatars');
    // 检查并创建上传目录
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      // 测试目录写入权限
      const testFile = path.join(uploadDir, '.test');
      fs.writeFileSync(testFile, '');
      fs.unlinkSync(testFile);
      cb(null, uploadDir);
    } catch (error) {
      console.error('目录权限错误:', error);
      cb(new Error('服务器配置错误：无法访问上传目录，请联系管理员'));
    }
  },
  filename: function (req, file, cb) {
    try {
      // 生成唯一文件名
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'avatar-' + uniqueSuffix + ext);
    } catch (error) {
      console.error('文件名生成错误:', error);
      cb(error);
    }
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: function (req, file, cb) {
    try {
      const allowedTypes = ['image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('只允许上传 JPG/PNG 格式的图片'));
      }
      cb(null, true);
    } catch (error) {
      console.error('文件类型验证错误:', error);
      cb(error);
    }
  }
}).single('avatar');

// 更新用户头像
exports.updateAvatar = async (req, res) => {
  try {
    upload(req, res, async function (err) {
      if (err) {
        console.error('文件上传错误:', err);
        return res.status(400).json({
          success: false,
          message: err.message || '头像上传失败',
          error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的头像'
        });
      }

      try {
        const userId = req.user.id;
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        // 更新数据库中的用户头像
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { avatar: avatarUrl },
          { new: true, select: '-password' }
        );

        // 尝试删除旧头像文件
        if (updatedUser.avatar && updatedUser.avatar !== avatarUrl) {
          const oldAvatarPath = path.join(__dirname, '../public', updatedUser.avatar);
          if (fs.existsSync(oldAvatarPath)) {
            try {
              fs.unlinkSync(oldAvatarPath);
            } catch (error) {
              console.error('删除旧头像失败:', error);
              // 不影响整体流程，继续执行
            }
          }
        }

        res.json({
          success: true,
          message: '头像上传成功',
          url: avatarUrl,
          user: updatedUser
        });
      } catch (error) {
        // 如果更新数据库失败，删除已上传的文件
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error('删除失败的上传文件错误:', unlinkError);
          }
        }
        throw error;
      }
    });
  } catch (error) {
    console.error('头像更新失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，头像更新失败',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 