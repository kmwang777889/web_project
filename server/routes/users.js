const express = require('express');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authenticate, isAdmin, isSuperAdmin } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

const router = express.Router();

// 获取所有用户（仅管理员可访问）
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'phone', 'email', 'brand', 'role', 'status', 'avatar', 'createdAt', 'updatedAt']
    });
    res.json(users);
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取管理员用户列表（用于分配负责人）
router.get('/admins', authenticate, async (req, res) => {
  try {
    const admins = await User.findAll({
      where: {
        role: ['admin', 'super_admin']
      },
      attributes: ['id', 'username', 'role', 'avatar']
    });
    res.json(admins);
  } catch (error) {
    console.error('获取管理员列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取单个用户信息
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 普通用户只能查看自己的信息，管理员可以查看所有用户
    if (req.user.role === 'user' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ message: '没有权限查看其他用户信息' });
    }
    
    const user = await User.findByPk(id, {
      attributes: ['id', 'username', 'phone', 'email', 'brand', 'role', 'status', 'avatar', 'createdAt', 'updatedAt']
    });
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新用户信息
router.put(
  '/:id',
  authenticate,
  upload.single('avatar'),
  handleUploadError,
  [
    body('phone').optional().notEmpty().withMessage('手机号不能为空'),
    body('email').optional().isEmail().withMessage('请输入有效的邮箱地址'),
    body('brand').optional().isIn(['EL', 'CL', 'MAC', 'DA', 'LAB', 'OR', 'Dr.jart+', 'IT']).withMessage('所属品牌无效'),
    body('status').optional().isIn(['active', 'disabled', 'pending']).withMessage('状态值无效')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // 普通用户只能修改自己的信息，管理员可以修改所有用户
      if (req.user.role === 'user' && req.user.id !== parseInt(id)) {
        return res.status(403).json({ message: '没有权限修改其他用户信息' });
      }
      
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const user = await User.findByPk(id);
      
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      // 准备更新数据
      const updateData = {};
      
      if (req.body.phone) updateData.phone = req.body.phone;
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.brand) updateData.brand = req.body.brand;
      
      // 如果有上传头像
      if (req.file) {
        updateData.avatar = `/uploads/images/${req.file.filename}`;
      }
      
      // 只有管理员可以修改角色和状态
      if ((req.user.role === 'admin' || req.user.role === 'super_admin')) {
        // 超级管理员可以设置任何角色，普通管理员不能设置超级管理员
        if (req.body.role) {
          if (req.user.role === 'super_admin' || req.body.role !== 'super_admin') {
            updateData.role = req.body.role;
          }
        }
        
        // 允许管理员更新用户状态
        if (req.body.status) {
          updateData.status = req.body.status;
        }
      }
      
      // 更新用户
      await user.update(updateData);
      
      res.json({
        message: '用户信息更新成功',
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          email: user.email,
          brand: user.brand,
          role: user.role,
          status: user.status,
          avatar: user.avatar,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      console.error('更新用户信息错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 修改密码
router.put(
  '/:id/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('当前密码不能为空'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少需要6个字符'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('新密码和确认密码不匹配');
      }
      return true;
    })
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // 只能修改自己的密码
      if (req.user.id !== parseInt(id)) {
        return res.status(403).json({ message: '只能修改自己的密码' });
      }
      
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      // 验证当前密码
      const isPasswordValid = await req.user.validatePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ message: '当前密码错误' });
      }
      
      // 更新密码
      await req.user.update({ password: newPassword });
      
      res.json({ message: '密码修改成功' });
    } catch (error) {
      console.error('修改密码错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 删除用户（仅超级管理员可操作）
router.delete('/:id', authenticate, isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 不能删除自己
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ message: '不能删除自己的账户' });
    }
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    await user.destroy();
    
    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router; 