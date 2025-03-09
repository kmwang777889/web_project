const express = require('express');
const { body, validationResult } = require('express-validator');
const { Ticket, User } = require('../models');
const { authenticate, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// 获取工单列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    
    // 构建查询条件
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (priority) {
      whereClause.priority = priority;
    }
    
    if (search) {
      whereClause.title = { [Op.like]: `%${search}%` };
    }
    
    // 普通用户只能查看自己创建的工单
    if (req.user.role === 'user') {
      whereClause.createdById = req.user.id;
    }
    
    // 管理员可以查看分配给自己的工单
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      if (req.query.assigned === 'true') {
        whereClause.assigneeId = req.user.id;
      }
    }
    
    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(tickets);
  } catch (error) {
    console.error('获取工单列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建工单
router.post(
  '/',
  authenticate,
  [
    body('title').notEmpty().withMessage('标题不能为空'),
    body('description').optional(),
    body('priority').isIn(['紧急', '高', '中', '低']).withMessage('优先级无效'),
    body('assigneeId').optional().isInt().withMessage('负责人ID必须是整数')
  ],
  async (req, res) => {
    try {
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { title, description, priority, assigneeId } = req.body;
      
      // 如果指定了负责人，检查负责人是否为管理员
      if (assigneeId) {
        const assignee = await User.findByPk(assigneeId);
        if (!assignee) {
          return res.status(404).json({ message: '指定的负责人不存在' });
        }
        
        if (assignee.role !== 'admin' && assignee.role !== 'super_admin') {
          return res.status(400).json({ message: '负责人必须是管理员或超级管理员' });
        }
      }
      
      // 创建工单
      const ticket = await Ticket.create({
        title,
        description: description || '',
        priority: priority || '中',
        status: '待处理',
        assigneeId: assigneeId || null,
        createdById: req.user.id,
        comments: []
      });
      
      res.status(201).json({
        message: '工单提交成功',
        ticket: {
          ...ticket.toJSON(),
          ticketNumber: ticket.ticketNumber
        }
      });
    } catch (error) {
      console.error('创建工单错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 获取单个工单详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const ticket = await Ticket.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'username', 'avatar', 'role']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar', 'role']
        }
      ]
    });
    
    if (!ticket) {
      return res.status(404).json({ message: '工单不存在' });
    }
    
    // 普通用户只能查看自己创建的工单
    if (req.user.role === 'user' && ticket.createdById !== req.user.id) {
      return res.status(403).json({ message: '没有权限查看此工单' });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error('获取工单详情错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新工单（仅管理员可操作）
router.put(
  '/:id',
  authenticate,
  isAdmin,
  [
    body('status').optional().isIn(['待处理', '进行中', '已完成', '关闭']).withMessage('状态无效'),
    body('assigneeId').optional().isInt().withMessage('负责人ID必须是整数')
  ],
  async (req, res) => {
    try {
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { status, assigneeId, comment } = req.body;
      
      const ticket = await Ticket.findByPk(id);
      
      if (!ticket) {
        return res.status(404).json({ message: '工单不存在' });
      }
      
      // 准备更新数据
      const updateData = {};
      
      if (status) updateData.status = status;
      if (assigneeId) updateData.assigneeId = assigneeId;
      
      // 如果有评论，添加到评论列表
      if (comment) {
        const newComment = {
          id: Date.now(),
          userId: req.user.id,
          username: req.user.username,
          content: comment,
          createdAt: new Date()
        };
        
        updateData.comments = [...(ticket.comments || []), newComment];
      }
      
      // 更新工单
      await ticket.update(updateData);
      
      res.json({
        message: '工单更新成功',
        ticket: await Ticket.findByPk(id, {
          include: [
            {
              model: User,
              as: 'assignee',
              attributes: ['id', 'username', 'avatar']
            },
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'username', 'avatar']
            }
          ]
        })
      });
    } catch (error) {
      console.error('更新工单错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 添加评论
router.post(
  '/:id/comments',
  authenticate,
  [
    body('content').notEmpty().withMessage('评论内容不能为空')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const ticket = await Ticket.findByPk(id);
      
      if (!ticket) {
        return res.status(404).json({ message: '工单不存在' });
      }
      
      // 普通用户只能评论自己创建的工单
      if (req.user.role === 'user' && ticket.createdById !== req.user.id) {
        return res.status(403).json({ message: '没有权限评论此工单' });
      }
      
      // 创建新评论
      const newComment = {
        id: Date.now(),
        userId: req.user.id,
        username: req.user.username,
        content,
        createdAt: new Date()
      };
      
      // 更新工单的评论
      await ticket.update({
        comments: [...(ticket.comments || []), newComment]
      });
      
      res.status(201).json({
        message: '评论添加成功',
        comment: newComment
      });
    } catch (error) {
      console.error('添加评论错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

module.exports = router; 