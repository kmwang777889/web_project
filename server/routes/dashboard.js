const express = require('express');
const { WorkItem, Project, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op, Sequelize } = require('sequelize');

const router = express.Router();

// 获取仪表盘统计数据
router.get('/stats', authenticate, async (req, res) => {
  try {
    // 根据用户角色确定查询条件
    const whereClause = {};
    
    // 普通用户只能查看自己创建的工作项
    if (req.user.role === 'user') {
      whereClause.createdById = req.user.id;
    }
    
    // 获取已完成工作项数量
    const completedCount = await WorkItem.count({
      where: {
        ...whereClause,
        status: '已完成'
      }
    });
    
    // 获取待完成工作项数量
    const pendingCount = await WorkItem.count({
      where: {
        ...whereClause,
        status: {
          [Op.notIn]: ['已完成', '关闭']
        }
      }
    });
    
    // 计算日均完成工作数
    // 获取过去30天内完成的工作项
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentCompletedItems = await WorkItem.findAll({
      where: {
        ...whereClause,
        status: '已完成',
        updated_at: {
          [Op.gte]: thirtyDaysAgo
        }
      },
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('updated_at')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: [Sequelize.fn('DATE', Sequelize.col('updated_at'))],
      raw: true
    });
    
    // 计算日均完成数
    const totalDays = recentCompletedItems.length || 1; // 避免除以零
    const totalCompleted = recentCompletedItems.reduce((sum, item) => sum + parseInt(item.count), 0);
    const dailyAverage = (totalCompleted / totalDays).toFixed(1);
    
    res.json({
      completedCount,
      pendingCount,
      dailyAverage
    });
  } catch (error) {
    console.error('获取仪表盘统计数据错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取待完成工作项列表
router.get('/pending-items', authenticate, async (req, res) => {
  try {
    const {
      title,
      type,
      status,
      priority,
      assigneeId,
      source,
      createdById
    } = req.query;
    
    // 构建查询条件
    const whereClause = {
      status: {
        [Op.notIn]: ['已完成', '关闭']
      }
    };
    
    if (title) {
      whereClause.title = { [Op.like]: `%${title}%` };
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    if (status && status !== '已完成' && status !== '关闭') {
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
    
    if (createdById) {
      whereClause.createdById = createdById;
    }
    
    // 普通用户只能查看自己创建的工作项
    if (req.user.role === 'user') {
      whereClause.createdById = req.user.id;
    }
    
    const pendingItems = await WorkItem.findAll({
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
      order: [
        ['priority', 'ASC'], // 优先级高的排前面
        ['createdAt', 'DESC'] // 创建时间新的排前面
      ]
    });
    
    // 计算每个工作项从创建至今的天数
    const pendingItemsWithDays = pendingItems.map(item => {
      const itemData = item.toJSON();
      const createdDate = new Date(itemData.createdAt);
      const today = new Date();
      const diffTime = Math.abs(today - createdDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...itemData,
        daysFromCreation: diffDays
      };
    });
    
    res.json(pendingItemsWithDays);
  } catch (error) {
    console.error('获取待完成工作项错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取甘特图数据
router.get('/gantt', authenticate, async (req, res) => {
  try {
    const { projectId, startDate, endDate } = req.query;
    
    // 构建查询条件
    const whereClause = {
      scheduledStartDate: { [Op.ne]: null },
      scheduledEndDate: { [Op.ne]: null }
    };
    
    if (projectId) {
      whereClause.projectId = projectId;
    }
    
    // 如果指定了日期范围
    if (startDate && endDate) {
      whereClause[Op.or] = [
        {
          scheduledStartDate: {
            [Op.between]: [new Date(startDate), new Date(endDate)]
          }
        },
        {
          scheduledEndDate: {
            [Op.between]: [new Date(startDate), new Date(endDate)]
          }
        },
        {
          [Op.and]: [
            { scheduledStartDate: { [Op.lte]: new Date(startDate) } },
            { scheduledEndDate: { [Op.gte]: new Date(endDate) } }
          ]
        }
      ];
    }
    
    // 普通用户只能查看自己创建的工作项
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
          model: Project,
          attributes: ['id', 'name']
        }
      ],
      order: [
        ['scheduledStartDate', 'ASC']
      ]
    });
    
    // 格式化为甘特图所需的数据格式
    const ganttData = workItems.map(item => ({
      id: item.id,
      title: item.title,
      start: item.scheduledStartDate,
      end: item.scheduledEndDate,
      progress: item.status === '已完成' ? 100 : 
               item.status === '进行中' ? 50 : 
               item.status === '待处理' ? 0 : 0,
      type: item.type,
      priority: item.priority,
      status: item.status,
      project: item.Project ? item.Project.name : null,
      assignee: item.assignee ? item.assignee.username : null
    }));
    
    // 获取所有项目（用于筛选）
    const projects = await Project.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });
    
    res.json({
      ganttData,
      projects
    });
  } catch (error) {
    console.error('获取甘特图数据错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router; 