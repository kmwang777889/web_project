require('dotenv').config({ path: '../.env' });
const { Sequelize } = require('sequelize');

// 创建一个新的Sequelize实例，不加载模型
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: console.log
  }
);

async function resetDatabase() {
  try {
    // 连接到数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 禁用外键检查
    await sequelize.query('SET FOREIGN_KEY_CHECKS=0');
    console.log('已禁用外键检查');

    // 删除所有表
    await sequelize.query('DROP TABLE IF EXISTS users, projects, workitems, tickets');
    console.log('已删除所有表');

    // 重新启用外键检查
    await sequelize.query('SET FOREIGN_KEY_CHECKS=1');
    console.log('已重新启用外键检查');

    console.log('数据库重置成功，现在可以重新启动应用程序');
    
    // 关闭连接
    await sequelize.close();
  } catch (error) {
    console.error('数据库重置失败:', error);
  }
}

// 执行重置
resetDatabase(); 