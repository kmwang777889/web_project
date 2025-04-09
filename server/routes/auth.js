const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// API状态检查端点
router.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'API服务器正常运行', 
    environment: process.env.NODE_ENV,
    serverTime: new Date().toISOString() 
  });
});

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
    body('email').optional().isEmail().withMessage('请输入有效的邮箱地址'),
    body('brand').isIn(['EL', 'CL', 'MAC', 'DA', 'LAB', 'OR', 'Dr.jart+', 'IT']).withMessage('所属品牌无效')
  ],
  async (req, res) => {
    try {
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password, phone, email, brand } = req.body;

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

      // 如果提供了邮箱，检查邮箱是否已存在
      if (email) {
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
          return res.status(400).json({ message: '邮箱已被注册' });
        }
      }

      // 创建新用户
      const user = await User.create({
        username,
        password,
        phone,
        email,
        brand,
        role: 'user' // 默认角色
      });

      // 生成JWT令牌
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: '注册成功',
        token,
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          email: user.email,
          brand: user.brand,
          role: user.role
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
    body('email').notEmpty().withMessage('邮箱不能为空').isEmail().withMessage('请输入有效的邮箱地址'),
    body('password').notEmpty().withMessage('密码不能为空')
  ],
  async (req, res) => {
    try {
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // 查找用户
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({ message: '邮箱或密码错误' });
      }

      // 验证密码
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: '邮箱或密码错误' });
      }

      // 生成JWT令牌
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
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
          email: user.email,
          brand: user.brand,
          role: user.role,
          status: user.status,
          avatar: user.avatar
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
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        phone: req.user.phone,
        email: req.user.email,
        brand: req.user.brand,
        role: req.user.role,
        status: req.user.status,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router; 