// 禁用弃用警告
process.noDeprecation = true;

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { sequelize, initializeDatabase } = require('./config/database');
const http = require('http');

// 导入app模块 (已包含路由和中间件配置)
const app = require('./app');

// 创建HTTP服务器
const server = http.createServer(app);

// 启动服务器函数
async function startServer() {
  try {
    console.log('正在启动服务器...');
    console.log('环境:', process.env.NODE_ENV);
    console.log('允许的客户端域名:', process.env.CLIENT_URL || 'http://localhost:3000');
    
    // 首先初始化数据库
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('数据库初始化失败，服务器无法启动');
      process.exit(1);
    }
    
    // 同步数据库模型
    console.log('正在同步数据库模型...');
    await sequelize.sync();
    console.log('数据库模型同步成功');
    
    // 启动 Express 服务器
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`API地址: ${process.env.NODE_ENV === 'production' ? 'https://' + process.env.DOMAIN : 'http://localhost:' + PORT}/api`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer(); 