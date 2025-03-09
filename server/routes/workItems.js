const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { WorkItem, User, Project } = require('../models');
const { authenticate, isAdmin, isCreatorOrAdmin } = require('../middleware/auth');
const { upload, handleUploadError, logUploadRequest } = require('../middleware/upload');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

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

// 获取单个工作项详情
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
    
    // 确保附件字段是数组
    if (!workItem.attachments) {
      workItem.attachments = [];
    }
    
    console.log('工作项附件数量:', workItem.attachments.length);
    
    res.json(workItem);
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
      
      // 准备更新数据
      const updateData = {};
      
      // 更新基本字段
      const fields = [
        'title', 'type', 'description', 'status', 'priority', 'source',
        'expectedCompletionDate', 'scheduledStartDate', 'scheduledEndDate',
        'projectId', 'assigneeId', 'estimatedHours', 'actualHours'
      ];
      
      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
          console.log(`更新字段 ${field}:`, req.body[field]);
        }
      });
      
      // 如果状态变为已完成，记录完成时间
      if (updateData.status === '已完成' && workItem.status !== '已完成') {
        updateData.completionDate = new Date();
        console.log('设置完成时间:', updateData.completionDate);
      }
      
      // 处理附件
      let existingAttachments = [];
      let newAttachments = [];
      
      // 检查是否有现有附件信息
      if (req.body.existingAttachments) {
        try {
          existingAttachments = JSON.parse(req.body.existingAttachments);
          console.log('从请求中解析的现有附件:', existingAttachments.length);
          console.log('现有附件示例:', existingAttachments.length > 0 ? JSON.stringify(existingAttachments[0], null, 2) : '无');
        } catch (error) {
          console.error('解析现有附件信息失败:', error);
          // 如果解析失败，使用工作项中的附件
          existingAttachments = workItem.attachments || [];
          console.log('使用工作项中的现有附件(解析失败):', existingAttachments.length);
        }
      } else if (workItem.attachments) {
        // 如果没有提供现有附件信息，使用工作项中的附件
        existingAttachments = workItem.attachments;
        console.log('使用工作项中的现有附件(未提供):', existingAttachments.length);
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
              
              // 文件存在，添加到新附件列表
              newAttachments.push(attachment);
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
                  
                  // 文件已复制，添加到新附件列表
                  newAttachments.push(attachment);
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
                  newAttachments.push(attachment);
                } else {
                  console.error('文件对象中没有buffer，无法直接写入');
                  
                  // 尝试从文件对象中获取路径并复制
                  if (file.path) {
                    try {
                      fs.copyFileSync(file.path, filePath);
                      console.log(`从文件路径复制文件: ${file.path} -> ${filePath}`);
                      newAttachments.push(attachment);
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
      
      // 合并现有附件和新附件
      updateData.attachments = [...existingAttachments, ...newAttachments];
      console.log('更新后的附件总数:', updateData.attachments.length);
      console.log('新增附件数量:', newAttachments.length);
      
      // 处理评论
      if (req.body.comment) {
        try {
          const comment = JSON.parse(req.body.comment);
          const comments = workItem.comments || [];
          updateData.comments = [...comments, comment];
          console.log('添加新评论:', comment);
        } catch (error) {
          console.error('解析评论失败:', error);
        }
      }
      
      console.log('更新数据:', JSON.stringify(updateData, null, 2));
      
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
    
    // 过滤掉要删除的附件
    const updatedAttachments = (workItem.attachments || []).filter(
      attachment => attachment.filename !== attachmentId
    );
    
    // 更新工作项
    await workItem.update({ attachments: updatedAttachments });
    
    res.json({
      message: '附件删除成功',
      attachments: updatedAttachments
    });
  } catch (error) {
    console.error('删除附件错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 导出工作项为Excel
router.get('/export', authenticate, async (req, res) => {
  try {
    console.log('收到导出请求，查询参数:', req.query);
    
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
    const filename = `工作项导出_${timestamp}.xlsx`;
    const safeFilename = `workitems_export_${timestamp}.xlsx`;
    const filepath = path.join(uploadsDir, safeFilename);
    
    console.log('保存Excel文件到:', filepath);
    
    try {
      // 保存Excel文件
      await workbook.xlsx.writeFile(filepath);
      
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
      path.join(uploadsDir, filename),
      path.join(__dirname, '../public/exports', filename),
      path.join(__dirname, '../uploads', filename)
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
        const files = fs.readdirSync(uploadsDir);
        console.log('目录中的文件:', files);
      } catch (readError) {
        console.error('读取目录失败:', readError);
      }
      
      return res.status(404).json({ message: '文件不存在或已被删除' });
    }
    
    // 获取文件信息
    try {
      const stats = fs.statSync(filepath);
      console.log('文件信息:', {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
    } catch (statError) {
      console.error('获取文件信息失败:', statError);
    }
    
    // 设置正确的Content-Type
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // 使用流式传输文件
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
    
    // 处理错误
    fileStream.on('error', (err) => {
      console.error('文件流错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: '文件读取错误' });
      }
    });
    
    // 处理完成
    fileStream.on('end', () => {
      console.log('文件传输完成');
    });
  } catch (error) {
    console.error('下载文件错误:', error);
    res.status(500).json({ message: '服务器错误: ' + error.message });
  }
});

module.exports = router; 