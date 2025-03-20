const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate, isAdmin } = require('../middleware/auth');

const router = express.Router();

// 注册用户
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').isLength({ min: 6 }).withMessage('密码至少需要6个字符'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('密码和确认密码不匹配');
      }
      return true;
    }),
    body('phone').notEmpty().withMessage('手机号不能为空'),
    body('brand').isIn(['EL', 'CL', 'MAC', 'DA', 'LAB', 'OR', 'Dr.jart+', 'IT']).withMessage('所属品牌无效')
  ],
  async (req, res) => {
    try {
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password, phone, brand } = req.body;

      // 检查用户名是否已存在
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res.status(400).json({ message: '用户名已存在' });
      }

      // 检查手机号是否已存在
      const existingPhone = await User.findOne({ where: { phone } });
      if (existingPhone) {
        return res.status(400).json({ message: '手机号已被注册' });
      }

      // 创建新用户，状态设为待审核
      const user = await User.create({
        username,
        password,
        phone,
        brand,
        role: 'user', // 默认角色
        status: 'pending' // 设置状态为待审核
      });

      res.status(201).json({
        message: '注册成功，请等待管理员审核后方可登录',
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          brand: user.brand,
          role: user.role,
          status: user.status
        }
      });
    } catch (error) {
      console.error('注册错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 用户登录
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
  ],
  async (req, res) => {
    try {
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // 查找用户
      const user = await User.findOne({ where: { username } });
      if (!user) {
        return res.status(401).json({ message: '用户名或密码错误' });
      }

      // 验证密码
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: '用户名或密码错误' });
      }

      // 检查用户是否已通过审核
      if (user.status !== 'approved') {
        if (user.status === 'pending') {
          return res.status(403).json({ message: '您的账号正在审核中，请等待管理员审核' });
        } else if (user.status === 'rejected') {
          return res.status(403).json({ message: '您的账号申请被拒绝，请联系管理员' });
        }
      }

      // 生成JWT令牌
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        message: '登录成功',
        token,
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          brand: user.brand,
          role: user.role,
          avatar: user.avatar,
          status: user.status
        }
      });
    } catch (error) {
      console.error('登录错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        brand: user.brand,
        role: user.role,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 新增: 获取待审核用户列表 (仅管理员可访问)
router.get('/pending-users', authenticate, isAdmin, async (req, res) => {
  try {
    const pendingUsers = await User.findAll({
      where: { status: 'pending' },
      attributes: ['id', 'username', 'phone', 'brand', 'role', 'status', 'createdAt']
    });
    
    res.json({ users: pendingUsers });
  } catch (error) {
    console.error('获取待审核用户列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 新增: 审核用户 (仅管理员可访问)
router.put('/approve-user/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ message: '状态值无效' });
    }
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 更新用户状态
    user.status = status;
    await user.save();
    
    res.json({ 
      message: status === 'approved' ? '用户审核通过' : '用户审核被拒绝',
      user: {
        id: user.id,
        username: user.username,
        status: user.status
      }
    });
  } catch (error) {
    console.error('审核用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router; 