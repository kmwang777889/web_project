const express = require('express');
const { body, validationResult } = require('express-validator');
const { Ticket, User } = require('../models');
const { authenticate, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// 获取工单列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      search, 
      createdById, 
      assigneeId, 
      unassigned,
      startDate,
      endDate
    } = req.query;
    
    console.log('工单列表查询参数:', req.query);
    
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
    
    if (createdById) {
      whereClause.createdById = createdById;
    }
    
    if (assigneeId) {
      whereClause.assigneeId = assigneeId;
    }
    
    if (unassigned === 'true') {
      whereClause.assigneeId = null;
    }
    
    // 日期范围筛选
    if (startDate || endDate) {
      whereClause.createdAt = {};
      
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate);
      }
      
      if (endDate) {
        // 设置结束日期为当天的23:59:59
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = endDateTime;
      }
    }
    
    // 普通用户只能查看自己创建的工单
    if (req.user.role === 'user') {
      whereClause.createdById = req.user.id;
    }
    
    console.log('最终查询条件:', whereClause);
    
    const tickets = await Ticket.findAll({
      where: whereClause,
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
      ],
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`查询到 ${tickets.length} 条工单记录`);
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
      console.log('开始创建工单，请求数据:', req.body);
      
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('请求验证错误:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { title, description, priority, assigneeId } = req.body;
      
      // 如果指定了负责人，检查负责人是否为管理员
      if (assigneeId) {
        const assignee = await User.findByPk(assigneeId);
        if (!assignee) {
          console.log('指定的负责人不存在:', assigneeId);
          return res.status(404).json({ message: '指定的负责人不存在' });
        }
        
        if (assignee.role !== 'admin' && assignee.role !== 'super_admin') {
          console.log('指定的负责人不是管理员:', assigneeId, assignee.role);
          return res.status(400).json({ message: '负责人必须是管理员或超级管理员' });
        }
      }
      
      // 生成工单编号
      const date = new Date();
      const year = date.getFullYear().toString().substr(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      // 获取当天的工单数量
      const count = await Ticket.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(date.setHours(0, 0, 0, 0))
          }
        }
      });
      
      // 生成工单编号: TK-年月日-序号
      const ticketNumber = `TK-${year}${month}${day}-${(count + 1).toString().padStart(3, '0')}`;
      console.log('生成的工单编号:', ticketNumber);
      
      // 创建工单
      const ticket = await Ticket.create({
        ticketNumber,
        title,
        description: description || '',
        priority: priority || '中',
        status: '待处理',
        assigneeId: assigneeId || null,
        createdById: req.user.id,
        comments: []
      });
      
      console.log('工单创建成功:', ticket.id, ticket.ticketNumber);
      
      res.status(201).json({
        message: '工单提交成功',
        ticket: {
          ...ticket.toJSON(),
          ticketNumber: ticket.ticketNumber
        }
      });
    } catch (error) {
      console.error('创建工单错误:', error);
      console.error('错误堆栈:', error.stack);
      res.status(500).json({ message: '服务器错误: ' + error.message });
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