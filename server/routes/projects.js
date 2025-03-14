const express = require('express');
const { body, validationResult } = require('express-validator');
const { Project, WorkItem, User } = require('../models');
const { authenticate, isAdmin, isCreatorOrAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

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
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        }
      ]
    });
    
    if (!project) {
      return res.status(404).json({ message: '项目不存在' });
    }
    
    // 确保导出目录存在
    const uploadsDir = path.join(__dirname, '../public/exports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('创建项目导出目录:', uploadsDir);
    }
    
    // 创建Excel工作簿和工作表
    const workbook = new ExcelJS.Workbook();
    const projectSheet = workbook.addWorksheet('项目信息');
    const workItemsSheet = workbook.addWorksheet('工作项列表');
    
    // 设置项目信息工作表
    projectSheet.columns = [
      { header: '属性', key: 'property', width: 20 },
      { header: '值', key: 'value', width: 50 }
    ];
    
    // 设置表头样式
    projectSheet.getRow(1).font = { bold: true };
    projectSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // 添加项目基本信息
    projectSheet.addRow({ property: '项目ID', value: project.id });
    projectSheet.addRow({ property: '项目名称', value: project.name });
    projectSheet.addRow({ property: '项目描述', value: project.description || '无' });
    projectSheet.addRow({ property: '项目状态', value: project.status });
    projectSheet.addRow({ property: '开始日期', value: project.startDate ? new Date(project.startDate).toLocaleDateString() : '未设置' });
    projectSheet.addRow({ property: '结束日期', value: project.endDate ? new Date(project.endDate).toLocaleDateString() : '未设置' });
    projectSheet.addRow({ property: '创建者', value: project.creator ? project.creator.username : '未知' });
    projectSheet.addRow({ property: '创建时间', value: new Date(project.createdAt).toLocaleString() });
    projectSheet.addRow({ property: '最后更新时间', value: new Date(project.updatedAt).toLocaleString() });
    projectSheet.addRow({ property: '工作项数量', value: project.WorkItems ? project.WorkItems.length : 0 });
    
    // 设置工作项列表工作表
    workItemsSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '标题', key: 'title', width: 30 },
      { header: '类型', key: 'type', width: 15 },
      { header: '状态', key: 'status', width: 15 },
      { header: '优先级', key: 'priority', width: 15 },
      { header: '创建者', key: 'creator', width: 15 },
      { header: '负责人', key: 'assignee', width: 15 },
      { header: '需求来源', key: 'source', width: 15 },
      { header: '创建日期', key: 'createdAt', width: 20 },
      { header: '期望完成日期', key: 'expectedCompletionDate', width: 20 },
      { header: '排期开始日期', key: 'scheduledStartDate', width: 20 },
      { header: '排期结束日期', key: 'scheduledEndDate', width: 20 },
      { header: '最后更新日期', key: 'updatedAt', width: 20 },
      { header: '描述', key: 'description', width: 40 }
    ];
    
    // 设置表头样式
    workItemsSheet.getRow(1).font = { bold: true };
    workItemsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // 添加工作项数据
    if (project.WorkItems && project.WorkItems.length > 0) {
      project.WorkItems.forEach(item => {
        workItemsSheet.addRow({
          id: item.id,
          title: item.title,
          type: item.type,
          status: item.status,
          priority: item.priority,
          creator: item.creator ? item.creator.username : '',
          assignee: item.assignee ? item.assignee.username : '',
          source: item.source || '',
          createdAt: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
          expectedCompletionDate: item.expectedCompletionDate ? new Date(item.expectedCompletionDate).toLocaleDateString() : '',
          scheduledStartDate: item.scheduledStartDate ? new Date(item.scheduledStartDate).toLocaleDateString() : '',
          scheduledEndDate: item.scheduledEndDate ? new Date(item.scheduledEndDate).toLocaleDateString() : '',
          updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '',
          description: item.description || ''
        });
      });
    }
    
    // 生成文件名
    const timestamp = new Date().getTime();
    const filename = `项目_${project.name}_${timestamp}.xlsx`;
    const safeFilename = `project_${project.id}_export_${timestamp}.xlsx`;
    const filepath = path.join(uploadsDir, safeFilename);
    
    console.log('保存Excel文件到:', filepath);
    
    try {
      // 保存Excel文件
      await workbook.xlsx.writeFile(filepath);
      
      // 检查文件是否成功创建
      if (fs.existsSync(filepath)) {
        console.log('Excel文件已成功创建，文件大小:', fs.statSync(filepath).size, '字节');
      } else {
        throw new Error('文件未成功创建');
      }
      
      // 返回文件下载URL
      const downloadUrl = `/exports/${safeFilename}`;
      console.log('下载URL:', downloadUrl);
      
      res.json({
        message: `已成功导出项目 "${project.name}" 及其 ${project.WorkItems ? project.WorkItems.length : 0} 个工作项`,
        success: true,
        downloadUrl,
        filename: filename // 发送原始中文文件名给前端
      });
    } catch (fileError) {
      console.error('保存Excel文件错误:', fileError);
      res.status(500).json({ message: '保存Excel文件失败: ' + fileError.message });
    }
  } catch (error) {
    console.error('导出项目错误:', error);
    res.status(500).json({ message: '服务器错误: ' + error.message });
  }
});

module.exports = router; 