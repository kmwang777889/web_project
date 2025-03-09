const express = require('express');
const { body, validationResult } = require('express-validator');
const { Project, WorkItem, User } = require('../models');
const { authenticate, isAdmin, isCreatorOrAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// 获取所有项目
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    // 构建查询条件
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (search) {
      whereClause.name = { [Op.like]: `%${search}%` };
    }
    
    const projects = await Project.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(projects);
  } catch (error) {
    console.error('获取项目列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建新项目（仅管理员可操作）
router.post(
  '/',
  authenticate,
  isAdmin,
  [
    body('name').notEmpty().withMessage('项目名称不能为空'),
    body('description').optional(),
    body('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
    body('endDate').optional().isISO8601().withMessage('结束日期格式无效')
      .custom((value, { req }) => {
        if (req.body.startDate && value && new Date(value) < new Date(req.body.startDate)) {
          throw new Error('结束日期不能早于开始日期');
        }
        return true;
      }),
    body('status').optional().isIn(['待处理', '进行中', '已完成', '关闭']).withMessage('状态无效')
  ],
  async (req, res) => {
    try {
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { name, description, startDate, endDate, status } = req.body;
      
      // 创建项目
      const project = await Project.create({
        name,
        description,
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || '待处理',
        createdById: req.user.id
      });
      
      res.status(201).json({
        message: '项目创建成功',
        project
      });
    } catch (error) {
      console.error('创建项目错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 获取单个项目详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: WorkItem,
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
        }
      ]
    });
    
    if (!project) {
      return res.status(404).json({ message: '项目不存在' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('获取项目详情错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新项目（仅管理员或创建者可操作）
router.put(
  '/:id',
  authenticate,
  isCreatorOrAdmin,
  [
    body('name').optional().notEmpty().withMessage('项目名称不能为空'),
    body('description').optional(),
    body('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
    body('endDate').optional().isISO8601().withMessage('结束日期格式无效')
      .custom((value, { req }) => {
        if (req.body.startDate && value && new Date(value) < new Date(req.body.startDate)) {
          throw new Error('结束日期不能早于开始日期');
        }
        return true;
      }),
    body('status').optional().isIn(['待处理', '进行中', '已完成', '关闭']).withMessage('状态无效')
  ],
  async (req, res) => {
    try {
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { name, description, startDate, endDate, status } = req.body;
      
      const project = await Project.findByPk(id);
      
      if (!project) {
        return res.status(404).json({ message: '项目不存在' });
      }
      
      // 更新项目
      await project.update({
        name: name || project.name,
        description: description !== undefined ? description : project.description,
        startDate: startDate !== undefined ? startDate : project.startDate,
        endDate: endDate !== undefined ? endDate : project.endDate,
        status: status || project.status
      });
      
      res.json({
        message: '项目更新成功',
        project
      });
    } catch (error) {
      console.error('更新项目错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
);

// 删除项目（仅管理员或创建者可操作）
router.delete('/:id', authenticate, isCreatorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findByPk(id);
    
    if (!project) {
      return res.status(404).json({ message: '项目不存在' });
    }
    
    // 检查项目是否有关联的工作项
    const workItemCount = await WorkItem.count({ where: { projectId: id } });
    
    if (workItemCount > 0) {
      return res.status(400).json({ 
        message: '无法删除项目，请先删除或转移项目中的工作项',
        workItemCount
      });
    }
    
    await project.destroy();
    
    res.json({ message: '项目删除成功' });
  } catch (error) {
    console.error('删除项目错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 导出项目为Excel
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findByPk(id, {
      include: [
        {
          model: WorkItem,
          include: [
            {
              model: User,
              as: 'assignee',
              attributes: ['id', 'username']
            },
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'username']
            }
          ]
        }
      ]
    });
    
    if (!project) {
      return res.status(404).json({ message: '项目不存在' });
    }
    
    // 这里应该实现导出Excel的逻辑
    // 由于实际导出Excel需要额外的库，这里只返回导出URL
    // 在实际实现中，可以使用exceljs或xlsx库生成Excel文件
    
    res.json({
      message: '项目导出功能待实现',
      exportUrl: `/api/projects/${id}/export-file`
    });
  } catch (error) {
    console.error('导出项目错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router; 