const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { WorkItem, User, Project, WorkItemActivity } = require('../models');
const { authenticate, isAdmin, isCreatorOrAdmin } = require('../middleware/auth');
const { upload, handleUploadError, logUploadRequest } = require('../middleware/upload');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// 获取字段的显示名称
function getFieldDisplayName(field) {
  const fieldMap = {
    'title': '标题',
    'description': '描述',
    'type': '类型',
    'status': '状态',
    'priority': '紧急程度',
    'source': '需求来源',
    'estimatedHours': '预估工时',
    'actualHours': '实际工时',
    'scheduledStartDate': '排期开始日期',
    'scheduledEndDate': '排期结束日期',
    'expectedCompletionDate': '期望完成日期',
    'completionDate': '实际完成日期',
    'projectId': '所属项目',
    'assigneeId': '负责人'
  };
  
  return fieldMap[field] || field;
}

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '../public/exports');
console.log('工作项导出目录路径:', uploadsDir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('创建工作项导出目录:', uploadsDir);
}

// 列出目录中的文件，帮助调试
try {
  const files = fs.readdirSync(uploadsDir);
  console.log('导出目录中的文件:', files);
} catch (readError) {
  console.error('读取导出目录失败:', readError);
}

const router = express.Router();

// 获取工作项列表（支持筛选）
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      title,
      projectId,
      type,
      status,
      priority,
      assigneeId,
      source,
      startDate,
      endDate,
      createdById
    } = req.query;
    
    // 构建查询条件
    const whereClause = {};
    
    if (title) {
      whereClause.title = { [Op.like]: `%${title}%` };
    }
    
    if (projectId) {
      whereClause.projectId = projectId;
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    if (status) {
      whereClause.status = status;
    }
    
    if (priority) {
      whereClause.priority = priority;
    }
    
    if (assigneeId) {
      whereClause.assigneeId = assigneeId;
    }
    
    if (source) {
      whereClause.source = source;
    }
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      whereClause.createdAt = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.createdAt = {
        [Op.lte]: new Date(endDate)
      };
    }
    
    if (createdById) {
      whereClause.createdById = createdById;
    }
    
    // 如果是普通用户，只能查看自己创建的工作项
    if (req.user.role === 'user') {
      whereClause.createdById = req.user.id;
    }
    
    const workItems = await WorkItem.findAll({
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
        },
        {
          model: Project,
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(workItems);
  } catch (error) {
    console.error('获取工作项列表错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取待排期工作项
router.get('/pending-schedule', authenticate, isAdmin, async (req, res) => {
  try {
    // 获取分配给当前用户且未排期的工作项
    const workItems = await WorkItem.findAll({
      where: {
        assigneeId: req.user.id,
        [Op.or]: [
          { scheduledStartDate: null },
          { scheduledEndDate: null }
        ],
        status: { [Op.ne]: '已完成' }
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: Project,
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(workItems);
  } catch (error) {
    console.error('获取待排期工作项错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建工作项
router.post(
  '/',
  authenticate,
  upload.array('attachments', 5),
  handleUploadError,
  [
    body('title').notEmpty().withMessage('标题不能为空'),
    body('type').isIn(['规划', '需求', '事务', '缺陷']).withMessage('类型无效'),
    body('description').optional(),
    body('status').optional().isIn(['待处理', '进行中', '已完成', '关闭']).withMessage('状态无效'),
    body('priority').optional().isIn(['紧急', '高', '中', '低']).withMessage('优先级无效'),
    body('source').optional().isIn(['内部需求', '品牌需求']).withMessage('需求来源无效'),
    body('expectedCompletionDate').optional().isISO8601().withMessage('期望完成日期格式无效'),
    body('projectId').optional().isInt().withMessage('项目ID必须是整数'),
    body('assigneeId').optional().isInt().withMessage('负责人ID必须是整数')
  ],
  async (req, res) => {
    try {
      console.log('===== 开始创建工作项 =====');
      console.log('请求头:', req.headers);
      console.log('请求体字段:', Object.keys(req.body));
      console.log('文件数量:', req.files ? req.files.length : 0);
      
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const {
        title,
        type,
        description,
        status,
        priority,
        source,
        expectedCompletionDate,
        projectId,
        assigneeId
      } = req.body;
      
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
      
      // 如果指定了项目，检查项目是否存在
      if (projectId) {
        const project = await Project.findByPk(projectId);
        if (!project) {
          return res.status(404).json({ message: '指定的项目不存在' });
        }
      }
      
      console.log('文件数量:', req.files ? req.files.length : 0);
      if (req.files && req.files.length > 0) {
        console.log('上传的文件:', req.files.map(f => f.originalname));
      }
      
      // 处理附件
      const attachments = [];
      
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          // 使用req.fileInfo中的信息
          let attachment;
          
          if (req.fileInfo && req.fileInfo[file.filename]) {
            const fileInfo = req.fileInfo[file.filename];
            
            attachment = {
              filename: file.filename,
              originalName: fileInfo.originalName,
              path: fileInfo.relativePath,
              mimetype: fileInfo.mimetype,
              size: file.size
            };
            
            console.log('使用fileInfo创建新附件:', attachment);
          } else {
            // 如果没有fileInfo，使用传统方式
            let originalName;
            try {
              originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            } catch (error) {
              console.error('文件名编码转换失败:', error);
              originalName = file.originalname;
            }
            
            const isImage = file.mimetype.startsWith('image/');
            const subDir = isImage ? 'images' : 'files';
            const relativePath = `/uploads/${subDir}/${file.filename}`;
            
            attachment = {
              filename: file.filename,
              originalName: originalName,
              path: relativePath,
              mimetype: file.mimetype,
              size: file.size
            };
            
            console.log('使用传统方式创建新附件:', attachment);
          }
          
          // 检查文件是否存在
          const filePath = path.join(__dirname, '../public', attachment.path);
          
          if (fs.existsSync(filePath)) {
            console.log(`文件已保存到: ${filePath}`);
            
            // 获取文件信息
            try {
              const stats = fs.statSync(filePath);
              console.log('文件信息:', {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
              });
              
              // 文件存在，添加到附件列表
              attachments.push(attachment);
            } catch (statError) {
              console.error('获取文件信息失败:', statError);
            }
          } else {
            console.error(`文件未找到: ${filePath}`);
            
            // 检查文件是否在其他位置
            const alternativePaths = [
              path.join(__dirname, '..', file.path),
              file.path,
              path.join(process.cwd(), file.path),
              path.join(process.cwd(), 'public', attachment.path),
              path.join(process.cwd(), 'server/public', attachment.path)
            ];
            
            let fileFound = false;
            console.log('尝试查找文件的其他位置:');
            
            for (const altPath of alternativePaths) {
              console.log(`- 检查: ${altPath}`);
              if (fs.existsSync(altPath)) {
                console.log(`  文件找到: ${altPath}`);
                fileFound = true;
                
                // 尝试复制文件到正确位置
                try {
                  const targetDir = path.dirname(filePath);
                  if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                    console.log(`  创建目录: ${targetDir}`);
                  }
                  
                  fs.copyFileSync(altPath, filePath);
                  console.log(`  文件已复制到: ${filePath}`);
                  
                  // 文件已复制，添加到附件列表
                  attachments.push(attachment);
                  break;
                } catch (copyError) {
                  console.error(`  复制文件失败: ${copyError.message}`);
                }
              }
            }
            
            if (!fileFound) {
              console.error('文件在所有可能的位置都未找到');
              
              // 尝试直接从请求中获取文件内容并保存
              try {
                // 确保目标目录存在
                const targetDir = path.dirname(filePath);
                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true });
                  console.log(`创建目录: ${targetDir}`);
                }
                
                // 如果文件对象中有buffer，直接写入文件
                if (file.buffer) {
                  fs.writeFileSync(filePath, file.buffer);
                  console.log(`从buffer直接写入文件: ${filePath}`);
                  attachments.push(attachment);
                } else {
                  console.error('文件对象中没有buffer，无法直接写入');
                  
                  // 尝试从文件对象中获取路径并复制
                  if (file.path) {
                    try {
                      fs.copyFileSync(file.path, filePath);
                      console.log(`从文件路径复制文件: ${file.path} -> ${filePath}`);
                      attachments.push(attachment);
                    } catch (copyError) {
                      console.error(`从文件路径复制失败: ${copyError.message}`);
                    }
                  }
                }
              } catch (writeError) {
                console.error('直接写入文件失败:', writeError);
              }
            }
          }
        }
      }
      
      console.log('附件数量:', attachments.length);
      if (attachments.length > 0) {
        console.log('附件示例:', JSON.stringify(attachments[0], null, 2));
      }
      
      // 创建工作项
      const workItem = await WorkItem.create({
        title,
        type,
        description: description || '',
        status: status || '待处理',
        priority: priority || '中',
        source: source || null,
        expectedCompletionDate: expectedCompletionDate || null,
        projectId: projectId || null,
        assigneeId: assigneeId || null,
        createdById: req.user.id,
        attachments
      });
      
      // 记录创建活动
      await recordActivity(
        workItem.id,
        req.user.id,
        'create',
        null,
        null,
        null,
        `创建了工作项 "${workItem.title}"`
      );
      
      // 如果指定了负责人，记录分配活动
      if (assigneeId) {
        const assignee = await User.findByPk(assigneeId);
        await recordActivity(
          workItem.id,
          req.user.id,
          'assignee_change',
          'assigneeId',
          null,
          assigneeId,
          `将工作项分配给 ${assignee.username}`
        );
      }
      
      console.log('工作项创建成功，ID:', workItem.id);
      console.log('===== 工作项创建完成 =====');
      
      res.status(201).json({
        message: '工作项创建成功',
        workItem
      });
    } catch (error) {
      console.error('创建工作项错误:', error);
      console.error('错误堆栈:', error.stack);
      res.status(500).json({ message: '服务器错误: ' + error.message });
    }
  }
);

// 先定义具体路由
router.get('/export', authenticate, async (req, res) => {
  try {
    console.log('收到导出请求，查询参数:', req.query);
    
    // 确保导出目录存在
    const uploadsDir = path.join(__dirname, '../public/exports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('创建工作项导出目录:', uploadsDir);
    }
    
    // 构建查询条件 - 简化为空对象，导出所有工作项
    let whereClause = {};
    
    // 如果是普通用户，只能导出自己创建的工作项
    if (req.user.role === 'user') {
      whereClause.createdById = req.user.id;
    }
    
    console.log('查询条件:', whereClause);
    
    // 查询工作项数据
    const workItems = await WorkItem.findAll({
      where: whereClause,
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
        },
        {
          model: Project,
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`查询到 ${workItems.length} 个工作项`);
    
    if (workItems.length === 0) {
      return res.status(404).json({ message: '没有找到工作项，请先创建工作项' });
    }
    
    // 打印第一个工作项的信息，帮助调试
    if (workItems.length > 0) {
      console.log('第一个工作项:', JSON.stringify(workItems[0], null, 2));
    }
    
    // 创建Excel工作簿和工作表
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('工作项列表');
    
    // 设置列头
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '标题', key: 'title', width: 30 },
      { header: '类型', key: 'type', width: 15 },
      { header: '状态', key: 'status', width: 15 },
      { header: '优先级', key: 'priority', width: 15 },
      { header: '项目', key: 'project', width: 20 },
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
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // 添加数据
    workItems.forEach(item => {
      worksheet.addRow({
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        priority: item.priority,
        project: item.Project ? item.Project.name : '',
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
    
    // 生成文件名
    const timestamp = new Date().getTime();
    const filename = `工作项_${timestamp}.xlsx`;
    const safeFilename = `workitems_export_${timestamp}.xlsx`;
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
        message: `已成功导出 ${workItems.length} 个工作项`,
        count: workItems.length,
        success: true,
        downloadUrl,
        filename: filename // 发送原始中文文件名给前端
      });
    } catch (fileError) {
      console.error('保存Excel文件错误:', fileError);
      res.status(500).json({ message: '保存Excel文件失败: ' + fileError.message });
    }
  } catch (error) {
    console.error('导出工作项错误:', error);
    res.status(500).json({ message: '服务器错误: ' + error.message });
  }
});

// 添加一个测试路由，用于检查工作项的附件字段
router.get('/test-attachments/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('测试工作项附件, ID:', id);
    
    // 直接从数据库获取工作项
    const workItem = await WorkItem.findByPk(id);
    
    if (!workItem) {
      return res.status(404).json({ message: '工作项不存在' });
    }
    
    // 打印原始附件字段
    console.log('原始附件字段类型:', typeof workItem.attachments);
    console.log('原始附件字段值:', workItem.attachments);
    
    // 尝试解析附件字段
    let parsedAttachments = [];
    if (!workItem.attachments) {
      parsedAttachments = [];
    } else if (typeof workItem.attachments === 'string') {
      try {
        const parsed = JSON.parse(workItem.attachments);
        if (Array.isArray(parsed)) {
          parsedAttachments = parsed;
        } else {
          console.error('解析后的附件不是数组:', parsed);
        }
      } catch (error) {
        console.error('解析附件字符串失败:', error);
      }
    } else if (Array.isArray(workItem.attachments)) {
      parsedAttachments = workItem.attachments;
    }
    
    // 返回测试结果
    res.json({
      id: workItem.id,
      title: workItem.title,
      originalAttachments: workItem.attachments,
      originalAttachmentsType: typeof workItem.attachments,
      parsedAttachments,
      parsedAttachmentsType: typeof parsedAttachments,
      isArray: Array.isArray(parsedAttachments)
    });
  } catch (error) {
    console.error('测试工作项附件错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取工作项详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('获取工作项详情, ID:', id);
    
    const workItem = await WorkItem.findByPk(id, {
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
        },
        {
          model: Project,
          attributes: ['id', 'name', 'status']
        }
      ]
    });
    
    if (!workItem) {
      return res.status(404).json({ message: '工作项不存在' });
    }
    
    // 创建一个可以修改的工作项副本
    const workItemData = workItem.toJSON();
    
    // 确保附件字段是数组
    if (!workItemData.attachments) {
      workItemData.attachments = [];
      console.log('工作项没有附件，设置为空数组');
    } else if (typeof workItemData.attachments === 'string') {
      try {
        const parsedAttachments = JSON.parse(workItemData.attachments);
        if (Array.isArray(parsedAttachments)) {
          workItemData.attachments = parsedAttachments;
          console.log('成功解析附件字符串为数组，数量:', parsedAttachments.length);
        } else {
          console.error('解析后的附件不是数组:', parsedAttachments);
          workItemData.attachments = [];
        }
      } catch (error) {
        console.error('解析附件字符串失败:', error);
        workItemData.attachments = [];
      }
    } else if (!Array.isArray(workItemData.attachments)) {
      console.error('附件字段既不是字符串也不是数组:', typeof workItemData.attachments);
      workItemData.attachments = [];
    }
    
    console.log('工作项附件数量:', workItemData.attachments.length);
    
    // 确保每个附件都有必要的字段
    if (workItemData.attachments.length > 0) {
      workItemData.attachments = workItemData.attachments
        .filter(attachment => attachment && typeof attachment === 'object')
        .map(attachment => {
          // 确保必要的字段存在
          if (!attachment.mimetype) {
            attachment.mimetype = 'application/octet-stream';
          }
          if (!attachment.originalName) {
            attachment.originalName = attachment.filename || '未命名文件';
          }
          if (!attachment.size) {
            attachment.size = 0;
          }
          return attachment;
        });
      
      console.log('处理后的附件数量:', workItemData.attachments.length);
      if (workItemData.attachments.length > 0) {
        console.log('附件示例:', JSON.stringify(workItemData.attachments[0]));
      }
    }
    
    // 在返回之前再次确认附件是数组
    if (!Array.isArray(workItemData.attachments)) {
      console.error('警告: 处理后的附件仍然不是数组，强制设置为空数组');
      workItemData.attachments = [];
    }
    
    res.json(workItemData);
  } catch (error) {
    console.error('获取工作项详情错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新工作项
router.put(
  '/:id',
  authenticate,
  isCreatorOrAdmin,
  logUploadRequest,
  (req, res, next) => {
    console.log('===== 开始处理工作项更新请求 =====');
    console.log('请求头 Content-Type:', req.headers['content-type']);
    console.log('请求体字段:', Object.keys(req.body));
    
    // 检查请求体中是否包含文件
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      console.log('这是一个文件上传请求');
      
      // 检查请求体中的文件字段
      if (req.body && req.body.attachments) {
        console.log('请求体中包含 attachments 字段');
      } else {
        console.warn('警告: 请求体中不包含 attachments 字段');
      }
      
      // 检查请求中的文件
      if (req.files) {
        console.log('请求中包含文件数组，长度:', req.files.length);
      } else if (req.file) {
        console.log('请求中包含单个文件:', req.file.originalname);
      } else {
        console.warn('警告: 请求中没有文件');
        
        // 检查请求的原始数据
        if (req.rawBody) {
          console.log('请求原始数据长度:', req.rawBody.length);
        } else {
          console.warn('警告: 请求中没有原始数据');
        }
      }
    } else {
      console.warn('警告: 这不是一个文件上传请求');
    }
    
    next();
  },
  upload.array('attachments', 5),
  handleUploadError,
  [
    body('title').optional().notEmpty().withMessage('标题不能为空'),
    body('type').optional().isIn(['规划', '需求', '事务', '缺陷']).withMessage('类型无效'),
    body('status').optional().isIn(['待处理', '进行中', '已完成', '关闭']).withMessage('状态无效'),
    body('priority').optional().isIn(['紧急', '高', '中', '低']).withMessage('优先级无效'),
    body('source').optional().isIn(['内部需求', '品牌需求']).withMessage('需求来源无效')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log('===== 开始更新工作项 =====');
      console.log('工作项ID:', id);
      console.log('请求头:', req.headers);
      console.log('请求体字段:', Object.keys(req.body));
      console.log('文件数量:', req.files ? req.files.length : 0);
      
      if (req.files && req.files.length > 0) {
        console.log('上传的文件:');
        req.files.forEach((file, index) => {
          console.log(`文件 ${index + 1}:`, {
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            destination: file.destination,
            filename: file.filename,
            path: file.path,
            size: file.size
          });
        });
      } else {
        console.log('没有上传文件');
        
        // 检查请求头中的 Content-Type
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
          console.warn('警告: 请求头中的 Content-Type 是 multipart/form-data，但没有接收到文件');
          console.log('请求头:', req.headers);
        }
      }
      
      // 查找工作项
      const workItem = await WorkItem.findByPk(id);
      if (!workItem) {
        console.error('工作项不存在, ID:', id);
        return res.status(404).json({ message: '工作项不存在' });
      }
      
      console.log('原始工作项:', JSON.stringify(workItem, null, 2));
      console.log('原始附件数量:', workItem.attachments ? workItem.attachments.length : 0);
      
      // 验证请求
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('请求验证错误:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }
      
      // 处理上传的附件
      let existingAttachments = [];
      let newAttachments = [];
      
      // 处理现有附件
      if (req.body.existingAttachments) {
        try {
          // 解析现有附件
          try {
            existingAttachments = JSON.parse(req.body.existingAttachments);
            if (!Array.isArray(existingAttachments)) {
              console.warn('解析后的existingAttachments不是数组:', existingAttachments);
              existingAttachments = [];
            } else {
              console.log('从请求中解析的现有附件:', existingAttachments.length);
              console.log('现有附件示例:', existingAttachments.length > 0 ? JSON.stringify(existingAttachments[0], null, 2) : '无');
            }
          } catch (parseError) {
            console.error('解析existingAttachments失败:', parseError);
            existingAttachments = [];
          }
        } catch (error) {
          console.error('处理现有附件时出错:', error);
          existingAttachments = [];
        }
      } else if (workItem.attachments) {
        // 如果没有提供现有附件信息，尝试使用工作项中的附件
        if (typeof workItem.attachments === 'string') {
          try {
            existingAttachments = JSON.parse(workItem.attachments);
            if (!Array.isArray(existingAttachments)) {
              console.warn('从工作项解析的attachments不是数组:', existingAttachments);
              existingAttachments = [];
            }
          } catch (parseError) {
            console.error('解析工作项附件失败:', parseError);
            existingAttachments = [];
          }
        } else if (Array.isArray(workItem.attachments)) {
          existingAttachments = workItem.attachments;
        } else {
          console.warn('工作项附件既不是字符串也不是数组:', typeof workItem.attachments);
          existingAttachments = [];
        }
        console.log('使用工作项中的现有附件:', existingAttachments.length);
      }
      
      // 处理新上传的附件
      if (req.files && req.files.length > 0) {
        console.log('收到新上传的附件:', req.files.length);
        
        for (const file of req.files) {
          // 使用req.fileInfo中的信息
          let attachment;
          
          if (req.fileInfo && req.fileInfo[file.filename]) {
            const fileInfo = req.fileInfo[file.filename];
            
            attachment = {
              filename: file.filename,
              originalName: fileInfo.originalName,
              path: fileInfo.relativePath,
              mimetype: fileInfo.mimetype,
              size: file.size
            };
            
            console.log('使用fileInfo创建新附件:', attachment);
          } else {
            // 如果没有fileInfo，使用传统方式
            let originalName;
            try {
              originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            } catch (error) {
              console.error('文件名编码转换失败:', error);
              originalName = file.originalname;
            }
            
            const isImage = file.mimetype.startsWith('image/');
            const subDir = isImage ? 'images' : 'files';
            const relativePath = `/uploads/${subDir}/${file.filename}`;
            
            attachment = {
              filename: file.filename,
              originalName: originalName,
              path: relativePath,
              mimetype: file.mimetype,
              size: file.size
            };
            
            console.log('使用传统方式创建新附件:', attachment);
          }
          
          // 检查文件是否存在
          const filePath = path.join(__dirname, '../public', attachment.path);
          if (!fs.existsSync(filePath)) {
            console.error('文件不存在:', filePath);
            return res.status(500).json({ message: '文件上传失败：文件未正确保存' });
          }
          
          // 将附件添加到新附件列表
          newAttachments.push(attachment);
          
          // 记录附件上传活动
          await recordActivity(
            id,
            req.user.id,
            'attachment_added',
            null,
            null,
            attachment.originalName,
            `添加了附件: ${attachment.originalName}`
          );
        }
      }
      
      // 处理删除的附件
      if (req.body.existingAttachments && workItem.attachments) {
        try {
          // 确保workItem.attachments是数组
          let currentAttachments = [];
          if (typeof workItem.attachments === 'string') {
            try {
              currentAttachments = JSON.parse(workItem.attachments);
              if (!Array.isArray(currentAttachments)) {
                console.warn('解析后的attachments不是数组:', currentAttachments);
                currentAttachments = [];
              }
            } catch (parseError) {
              console.error('解析工作项附件失败:', parseError);
              currentAttachments = [];
            }
          } else if (Array.isArray(workItem.attachments)) {
            currentAttachments = workItem.attachments;
          } else {
            console.warn('工作项附件既不是字符串也不是数组:', typeof workItem.attachments);
            currentAttachments = [];
          }
          
          console.log('当前附件数量:', currentAttachments.length);
          console.log('保留的附件数量:', existingAttachments.length);
          
          // 找出被删除的附件
          const deletedAttachments = currentAttachments.filter(
            attachment => !existingAttachments.some(ea => ea.path === attachment.path)
          );
          
          console.log('删除的附件数量:', deletedAttachments.length);
          
          // 记录删除附件的活动
          for (const attachment of deletedAttachments) {
            await recordActivity(
              id,
              req.user.id,
              'attachment_delete',
              'attachments',
              attachment.originalName || attachment.originalname,
              null,
              `删除了附件 "${attachment.originalName || attachment.originalname}"`
            );
          }
        } catch (error) {
          console.error('处理删除附件时出错:', error);
          // 继续执行，不中断更新过程
        }
      }
      
      // 准备更新数据
      const updateData = {};
      
      // 记录字段变更
      const fields = [
        'title', 'type', 'description', 'status', 'priority', 'source',
        'expectedCompletionDate', 'scheduledStartDate', 'scheduledEndDate',
        'projectId', 'assigneeId', 'estimatedHours', 'actualHours'
      ];
      
      for (const field of fields) {
        if (req.body[field] !== undefined && req.body[field] !== workItem[field]) {
          updateData[field] = req.body[field];
          console.log(`更新字段 ${field}:`, req.body[field]);
          
          // 对特殊字段进行特殊处理
          if (field === 'status') {
            await recordActivity(
              id,
              req.user.id,
              'status_change',
              field,
              workItem[field],
              req.body[field],
              `将状态从 "${workItem[field]}" 修改为 "${req.body[field]}"`
            );
            
            // 如果状态变为已完成，自动设置完成日期
            if (req.body[field] === '已完成' && workItem[field] !== '已完成') {
              const today = new Date().toISOString().split('T')[0];
              updateData.completionDate = today;
              console.log('状态变为已完成，自动设置完成日期:', today);
              
              // 记录完成日期变更活动
              await recordActivity(
                id,
                req.user.id,
                'update',
                'completionDate',
                workItem.completionDate,
                today,
                `自动设置完成日期为 ${today}`
              );
            }
          } else if (field === 'assigneeId') {
            const oldAssignee = workItem.assigneeId ? await User.findByPk(workItem.assigneeId) : null;
            const newAssignee = req.body[field] ? await User.findByPk(req.body[field]) : null;
            await recordActivity(
              id,
              req.user.id,
              'assignee_change',
              field,
              workItem[field],
              req.body[field],
              `将负责人从 ${oldAssignee ? oldAssignee.username : '未分配'} 修改为 ${newAssignee ? newAssignee.username : '未分配'}`
            );
          } else {
            await recordActivity(
              id,
              req.user.id,
              'update',
              field,
              workItem[field],
              req.body[field],
              `修改了 ${getFieldDisplayName(field)} 字段，从 "${workItem[field] || '空'}" 修改为 "${req.body[field]}"`
            );
          }
        }
      }
      
      // 如果客户端已经设置了completionDate，则使用客户端设置的值
      if (req.body.completionDate !== undefined) {
        updateData.completionDate = req.body.completionDate;
        console.log('使用客户端设置的完成日期:', req.body.completionDate);
      }
      
      // 合并现有附件和新附件
      updateData.attachments = [...existingAttachments, ...newAttachments];
      console.log('更新后的附件总数:', updateData.attachments.length);
      console.log('现有附件数量:', existingAttachments.length);
      console.log('新增附件数量:', newAttachments.length);
      
      // 打印附件详情，用于调试
      if (updateData.attachments.length > 0) {
        console.log('附件详情:');
        updateData.attachments.forEach((attachment, index) => {
          console.log(`附件 ${index + 1}:`, {
            filename: attachment.filename,
            originalName: attachment.originalName,
            path: attachment.path,
            mimetype: attachment.mimetype,
            size: attachment.size
          });
          
          // 检查文件是否存在
          const filePath = path.join(__dirname, '../public', attachment.path);
          console.log(`文件是否存在: ${fs.existsSync(filePath)}`);
        });
      }
      
      // 处理评论
      if (req.body.comment) {
        const comment = JSON.parse(req.body.comment);
        await recordActivity(
          id,
          req.user.id,
          'comment',
          null,
          null,
          comment.content,
          comment.content
        );
      }
      
      console.log('最终更新数据:', JSON.stringify(updateData, null, 2));
      
      // 确保附件字段是JSON格式
      if (updateData.attachments) {
        // 检查是否需要将attachments转换为JSON字符串
        if (typeof updateData.attachments !== 'string') {
          try {
            // 先尝试将其转换为JSON字符串
            const attachmentsJson = JSON.stringify(updateData.attachments);
            console.log('附件已转换为JSON字符串，长度:', attachmentsJson.length);
            
            // 检查是否是有效的JSON
            const parsed = JSON.parse(attachmentsJson);
            if (Array.isArray(parsed)) {
              console.log('附件是有效的JSON数组，包含', parsed.length, '个项目');
            } else {
              console.warn('警告: 附件不是数组');
            }
            
            // 更新字段
            updateData.attachments = attachmentsJson;
          } catch (error) {
            console.error('转换附件为JSON字符串失败:', error);
            // 如果转换失败，使用空数组
            updateData.attachments = '[]';
          }
        } else {
          console.log('附件已经是字符串格式');
          
          // 验证字符串是否是有效的JSON数组
          try {
            const parsed = JSON.parse(updateData.attachments);
            if (!Array.isArray(parsed)) {
              console.warn('警告: 附件字符串解析后不是数组，重置为空数组');
              updateData.attachments = '[]';
            }
          } catch (error) {
            console.error('解析附件字符串失败，重置为空数组:', error);
            updateData.attachments = '[]';
          }
        }
      } else {
        // 如果没有附件字段，设置为空数组
        updateData.attachments = '[]';
        console.log('没有附件字段，设置为空数组');
      }
      
      // 更新工作项
      await workItem.update(updateData);
      console.log('工作项更新成功');
      
      // 获取更新后的工作项（包含关联数据）
      const updatedWorkItem = await WorkItem.findByPk(id, {
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
          },
          {
            model: Project,
            attributes: ['id', 'name']
          }
        ]
      });
      
      console.log('更新后的工作项附件数量:', updatedWorkItem.attachments ? updatedWorkItem.attachments.length : 0);
      if (updatedWorkItem.attachments && updatedWorkItem.attachments.length > 0) {
        console.log('更新后的附件示例:', JSON.stringify(updatedWorkItem.attachments[0], null, 2));
      }
      console.log('===== 工作项更新完成 =====');
      
      res.json({
        message: '工作项更新成功',
        workItem: updatedWorkItem
      });
    } catch (error) {
      console.error('更新工作项错误:', error);
      console.error('错误堆栈:', error.stack);
      res.status(500).json({ message: '服务器错误: ' + error.message });
    }
  }
);

// 删除工作项
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const workItem = await WorkItem.findByPk(id);
    
    if (!workItem) {
      return res.status(404).json({ message: '工作项不存在' });
    }
    
    // 检查权限
    // 普通用户只能删除自己创建的工作项
    if (req.user.role === 'user' && workItem.createdById !== req.user.id) {
      return res.status(403).json({ message: '没有权限删除此工作项' });
    }
    
    await workItem.destroy();
    
    res.json({ message: '工作项删除成功' });
  } catch (error) {
    console.error('删除工作项错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

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
      
      const workItem = await WorkItem.findByPk(id);
      
      if (!workItem) {
        return res.status(404).json({ message: '工作项不存在' });
      }
      
      // 创建新评论
      const newComment = {
        id: Date.now(),
        userId: req.user.id,
        username: req.user.username,
        content,
        createdAt: new Date()
      };
      
      // 更新工作项的评论
      await workItem.update({
        comments: [...(workItem.comments || []), newComment]
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

// 删除附件
router.delete('/:id/attachments/:attachmentId', authenticate, async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    
    const workItem = await WorkItem.findByPk(id);
    
    if (!workItem) {
      return res.status(404).json({ message: '工作项不存在' });
    }
    
    // 检查权限
    // 普通用户只能修改自己创建的工作项
    if (req.user.role === 'user' && workItem.createdById !== req.user.id) {
      return res.status(403).json({ message: '没有权限修改此工作项' });
    }
    
    // 确保attachments是数组
    let currentAttachments = [];
    
    if (!workItem.attachments) {
      console.log('工作项没有附件，设置为空数组');
      currentAttachments = [];
    } else if (typeof workItem.attachments === 'string') {
      try {
        const parsedAttachments = JSON.parse(workItem.attachments);
        if (Array.isArray(parsedAttachments)) {
          currentAttachments = parsedAttachments;
          console.log('成功解析附件字符串为数组，数量:', parsedAttachments.length);
        } else {
          console.error('解析后的附件不是数组:', parsedAttachments);
          currentAttachments = [];
        }
      } catch (error) {
        console.error('解析附件字符串失败:', error);
        currentAttachments = [];
      }
    } else if (Array.isArray(workItem.attachments)) {
      currentAttachments = workItem.attachments;
    } else {
      console.error('附件字段既不是字符串也不是数组:', typeof workItem.attachments);
      currentAttachments = [];
    }
    
    console.log('当前附件数量:', currentAttachments.length);
    console.log('要删除的附件ID:', attachmentId);
    
    // 过滤掉要删除的附件
    const updatedAttachments = currentAttachments.filter(
      attachment => attachment && attachment.filename !== attachmentId
    );
    
    console.log('更新后的附件数量:', updatedAttachments.length);
    
    // 将附件数组转换为JSON字符串
    const attachmentsJson = JSON.stringify(updatedAttachments);
    
    // 更新工作项
    await workItem.update({ attachments: attachmentsJson });
    
    res.json({
      message: '附件删除成功',
      attachments: updatedAttachments
    });
  } catch (error) {
    console.error('删除附件错误:', error);
    res.status(500).json({ message: '服务器错误: ' + error.message });
  }
});

// 下载导出的Excel文件
router.get('/download/:filename', authenticate, (req, res) => {
  try {
    const { filename } = req.params;
    console.log('请求下载文件:', filename);
    
    // 安全检查：确保文件名只包含安全字符
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      console.error('不安全的文件名:', filename);
      return res.status(400).json({ message: '无效的文件名' });
    }
    
    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(__dirname, '../public/uploads/files', filename),
      path.join(__dirname, '../public/uploads/images', filename),
      path.join(__dirname, '../public/uploads', filename),
      path.join(__dirname, '../public/exports', filename)
    ];
    
    let filepath = null;
    for (const p of possiblePaths) {
      console.log('尝试路径:', p);
      if (fs.existsSync(p)) {
        filepath = p;
        console.log('找到文件:', filepath);
        break;
      }
    }
    
    if (!filepath) {
      console.error('文件不存在，尝试的路径:', possiblePaths);
      
      // 列出目录中的文件，帮助调试
      try {
        console.log('检查目录内容:');
        const uploadsDir = path.join(__dirname, '../public/uploads');
        const filesDir = path.join(uploadsDir, 'files');
        const imagesDir = path.join(uploadsDir, 'images');
        const exportsDir = path.join(__dirname, '../public/exports');
        
        if (fs.existsSync(uploadsDir)) {
          console.log('uploads目录内容:', fs.readdirSync(uploadsDir));
        }
        if (fs.existsSync(filesDir)) {
          console.log('files目录内容:', fs.readdirSync(filesDir));
        }
        if (fs.existsSync(imagesDir)) {
          console.log('images目录内容:', fs.readdirSync(imagesDir));
        }
        if (fs.existsSync(exportsDir)) {
          console.log('exports目录内容:', fs.readdirSync(exportsDir));
        }
      } catch (readError) {
        console.error('读取目录失败:', readError);
      }
      
      return res.status(404).json({ message: '文件不存在或已被删除' });
    }
    
    // 获取文件信息
    const stat = fs.statSync(filepath);
    const fileSize = stat.size;
    const mimetype = path.extname(filepath).toLowerCase() === '.xlsx' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/octet-stream';
    
    // 设置响应头
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    // 创建文件读取流并发送
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
    
    console.log('文件下载开始:', filepath);
    
    // 处理错误
    fileStream.on('error', (error) => {
      console.error('文件流错误:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: '文件读取错误' });
      } else {
        res.end();
      }
    });
    
    // 处理完成
    fileStream.on('end', () => {
      console.log('文件下载完成:', filepath);
    });
  } catch (error) {
    console.error('下载文件错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取工作项活动历史
router.get('/:id/activities', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('获取工作项活动历史, ID:', id);
    
    const activities = await WorkItemActivity.findAll({
      where: { workItemId: id },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'username', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    console.log('找到活动记录数量:', activities.length);
    console.log('活动记录:', JSON.stringify(activities, null, 2));
    
    res.json(activities);
  } catch (error) {
    console.error('获取工作项活动历史失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      originalError: error.original
    });
    res.status(500).json({ message: '服务器错误' });
  }
});

// 记录活动历史的辅助函数
async function recordActivity(workItemId, userId, type, field = null, oldValue = null, newValue = null, description) {
  try {
    console.log('开始记录活动历史:', {
      workItemId,
      userId,
      type,
      field,
      oldValue,
      newValue,
      description
    });

    const activity = await WorkItemActivity.create({
      workItemId,
      userId,
      type,
      field,
      oldValue: oldValue ? String(oldValue) : null,
      newValue: newValue ? String(newValue) : null,
      description
    });

    console.log('活动历史记录成功:', activity.id);
    return activity;
  } catch (error) {
    console.error('记录活动历史失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      originalError: error.original
    });
    throw error; // 抛出错误以便调用者知道记录失败
  }
}

// 添加一个简单的测试上传路由
router.post('/test-upload-simple', upload.single('file'), (req, res) => {
  try {
    console.log('收到文件上传请求');
    console.log('请求头:', req.headers);
    console.log('请求体字段:', Object.keys(req.body));
    
    if (!req.file) {
      console.log('没有上传文件');
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }
    
    console.log('上传的文件:', req.file);
    
    // 获取文件信息
    let attachment;
    
    if (req.fileInfo && req.fileInfo[req.file.filename]) {
      const fileInfo = req.fileInfo[req.file.filename];
      
      attachment = {
        filename: req.file.filename,
        originalName: fileInfo.originalName,
        path: fileInfo.relativePath,
        mimetype: fileInfo.mimetype,
        size: req.file.size
      };
      
      console.log('使用fileInfo创建附件:', attachment);
    } else {
      // 如果没有fileInfo，使用传统方式
      let originalName;
      try {
        originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      } catch (error) {
        console.error('文件名编码转换失败:', error);
        originalName = req.file.originalname;
      }
      
      const isImage = req.file.mimetype.startsWith('image/');
      const subDir = isImage ? 'images' : 'files';
      const relativePath = `/uploads/${subDir}/${req.file.filename}`;
      
      attachment = {
        filename: req.file.filename,
        originalName: originalName,
        path: relativePath,
        mimetype: req.file.mimetype,
        size: req.file.size
      };
      
      console.log('使用传统方式创建附件:', attachment);
    }
    
    // 检查文件是否存在
    const filePath = path.join(__dirname, '../public', attachment.path);
    let fileExists = fs.existsSync(filePath);
    
    if (!fileExists) {
      console.error('文件不存在:', filePath);
      
      // 尝试查找文件的其他可能位置
      const alternativePaths = [
        path.join(__dirname, '..', req.file.path),
        req.file.path,
        path.join(process.cwd(), req.file.path),
        path.join(process.cwd(), 'public', attachment.path),
        path.join(process.cwd(), 'server/public', attachment.path)
      ];
      
      console.log('尝试查找文件的其他位置:');
      
      for (const altPath of alternativePaths) {
        console.log(`- 检查: ${altPath}`);
        if (fs.existsSync(altPath)) {
          console.log(`  文件找到: ${altPath}`);
          fileExists = true;
          
          // 更新附件路径为找到的路径
          const relativePath = altPath.replace(process.cwd(), '').replace(/\\/g, '/');
          attachment.path = relativePath;
          console.log('更新附件路径为:', attachment.path);
          break;
        }
      }
      
      if (!fileExists) {
        return res.status(500).json({ success: false, message: '文件上传失败：文件未正确保存' });
      }
    } else {
      console.log('文件已保存到:', filePath);
    }
    
    // 如果请求中包含工作项ID，则将附件添加到工作项
    if (req.body.workItemId) {
      const workItemId = req.body.workItemId;
      console.log('将附件添加到工作项:', workItemId);
      
      // 这里可以添加将附件添加到工作项的逻辑
      // 但我们现在使用客户端的方式，通过单独的请求更新工作项
    }
    
    // 返回成功响应
    res.json({
      success: true,
      message: '文件上传成功',
      file: {
        originalname: attachment.originalName,
        filename: attachment.filename,
        path: attachment.path,
        size: attachment.size,
        mimetype: attachment.mimetype
      }
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({ success: false, message: '上传失败: ' + error.message });
  }
});

module.exports = router; 