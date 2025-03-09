const User = require('./User');
const Project = require('./Project');
const WorkItem = require('./WorkItem');
const Ticket = require('./Ticket');
const { sequelize } = require('../config/database');

// 在建立关联关系之前，确保所有模型都已经初始化
// 这样可以确保表的创建顺序正确

// 定义模型之间的关联关系
// 先定义User和Project之间的关系
User.hasMany(Project, { 
  foreignKey: 'createdById', 
  as: 'createdProjects',
  onDelete: 'CASCADE' // 当用户被删除时，级联删除相关项目
});
Project.belongsTo(User, { 
  foreignKey: 'createdById', 
  as: 'creator'
});

// 然后定义User和WorkItem之间的关系
User.hasMany(WorkItem, { 
  foreignKey: 'assigneeId', 
  as: 'assignedWorkItems',
  onDelete: 'SET NULL' // 当用户被删除时，将工作项的负责人设为NULL
});
WorkItem.belongsTo(User, { 
  foreignKey: 'assigneeId', 
  as: 'assignee'
});

User.hasMany(WorkItem, { 
  foreignKey: 'createdById', 
  as: 'createdWorkItems',
  onDelete: 'CASCADE' // 当用户被删除时，级联删除相关工作项
});
WorkItem.belongsTo(User, { 
  foreignKey: 'createdById', 
  as: 'creator'
});

// 最后定义Project和WorkItem之间的关系
Project.hasMany(WorkItem, { 
  foreignKey: 'projectId',
  onDelete: 'SET NULL' // 当项目被删除时，将工作项的项目ID设为NULL
});
WorkItem.belongsTo(Project, { 
  foreignKey: 'projectId'
});

// 定义User和Ticket之间的关系
User.hasMany(Ticket, { 
  foreignKey: 'assigneeId', 
  as: 'assignedTickets',
  onDelete: 'SET NULL' // 当用户被删除时，将工单的负责人设为NULL
});
Ticket.belongsTo(User, { 
  foreignKey: 'assigneeId', 
  as: 'assignee'
});

User.hasMany(Ticket, { 
  foreignKey: 'createdById', 
  as: 'createdTickets',
  onDelete: 'CASCADE' // 当用户被删除时，级联删除相关工单
});
Ticket.belongsTo(User, { 
  foreignKey: 'createdById', 
  as: 'creator'
});

// Export models and sequelize instance
module.exports = {
  sequelize,
  User,
  Project,
  WorkItem,
  Ticket
}; 