const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const WorkItemActivity = sequelize.define('WorkItemActivity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  workItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'workitems',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM(
      'create',           // 创建工作项
      'update',           // 更新工作项
      'status_change',    // 状态变更
      'assignee_change',  // 负责人变更
      'comment',          // 添加评论
      'attachment_add',   // 添加附件
      'attachment_delete' // 删除附件
    ),
    allowNull: false
  },
  field: {
    type: DataTypes.STRING,
    allowNull: true
  },
  oldValue: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  newValue: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'workitem_activities',
  indexes: [
    {
      fields: ['workItemId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['type']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// 添加与User模型的关联关系
WorkItemActivity.belongsTo(User, {
  foreignKey: 'userId',
  as: 'User'
});

module.exports = WorkItemActivity; 