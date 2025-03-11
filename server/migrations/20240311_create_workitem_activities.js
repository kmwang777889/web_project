const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('workitem_activities', {
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
        },
        onDelete: 'CASCADE'
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
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
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 添加索引以提高查询性能
    await queryInterface.addIndex('workitem_activities', ['workItemId']);
    await queryInterface.addIndex('workitem_activities', ['userId']);
    await queryInterface.addIndex('workitem_activities', ['type']);
    await queryInterface.addIndex('workitem_activities', ['createdAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('workitem_activities');
  }
}; 