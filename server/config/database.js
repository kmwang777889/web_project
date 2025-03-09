const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库配置
const DB_NAME = process.env.DB_NAME || 'project_management';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;

// 创建数据库连接
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// 初始化数据库函数
async function initializeDatabase() {
  console.log('正在初始化数据库...');
  
  try {
    // 首先尝试创建数据库（如果不存在）
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD
    });
    
    console.log('已连接到MySQL服务器，检查数据库是否存在...');
    
    // 检查数据库是否存在
    const [rows] = await connection.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${DB_NAME}'`
    );
    
    if (rows.length === 0) {
      console.log(`数据库 '${DB_NAME}' 不存在，正在创建...`);
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
      console.log(`数据库 '${DB_NAME}' 创建成功`);
    } else {
      console.log(`数据库 '${DB_NAME}' 已存在`);
    }
    
    await connection.end();
    
    // 测试 Sequelize 连接
    await sequelize.authenticate();
    console.log('Sequelize 连接成功');
    
    return true;
  } catch (error) {
    console.error('初始化数据库失败:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  initializeDatabase,
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false
}; 