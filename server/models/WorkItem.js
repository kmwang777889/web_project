const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkItem = sequelize.define('WorkItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('规划', '需求', '事务', '缺陷'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('待处理', '进行中', '已完成', '关闭'),
    defaultValue: '待处理'
  },
  priority: {
    type: DataTypes.ENUM('紧急', '高', '中', '低'),
    defaultValue: '中'
  },
  source: {
    type: DataTypes.ENUM('内部需求', '品牌需求'),
    allowNull: true
  },
  estimatedHours: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  actualHours: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  scheduledStartDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  scheduledEndDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expectedCompletionDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completionDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  projectId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  assigneeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  attachments: {
    type: DataTypes.JSON,
    allowNull: true
  },
  comments: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'workitems'
});

module.exports = WorkItem; 