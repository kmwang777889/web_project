const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ticketNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
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
  priority: {
    type: DataTypes.ENUM('紧急', '高', '中', '低'),
    defaultValue: '中'
  },
  status: {
    type: DataTypes.ENUM('待处理', '进行中', '已完成', '关闭'),
    defaultValue: '待处理'
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
  comments: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'tickets',
});

// 生成工单编号的钩子
Ticket.beforeCreate(async (ticket) => {
  const date = new Date();
  const year = date.getFullYear().toString().substr(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // 获取当天的工单数量
  const count = await Ticket.count({
    where: {
      createdAt: {
        [sequelize.Op.gte]: new Date(date.setHours(0, 0, 0, 0))
      }
    }
  });
  
  // 生成工单编号: TK-年月日-序号
  ticket.ticketNumber = `TK-${year}${month}${day}-${(count + 1).toString().padStart(3, '0')}`;
});

module.exports = Ticket; 