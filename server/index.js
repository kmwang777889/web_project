// 禁用弃用警告
process.noDeprecation = true;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sequelize, initializeDatabase } = require('./config/database');
const http = require('http');

// 导入路由
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const workItemRoutes = require('./routes/workItems');
const userRoutes = require('./routes/users');
const ticketRoutes = require('./routes/tickets');
const dashboardRoutes = require('./routes/dashboard');

// 引入数据初始化脚本
const initializeData = require('./scripts/initializeData');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件目录
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/exports', express.static(path.join(__dirname, 'public/exports')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// 添加路径调试信息
console.log('静态文件目录 - uploads:', path.join(__dirname, 'public/uploads'));
console.log('静态文件目录 - exports:', path.join(__dirname, 'public/exports'));
console.log('静态文件目录 - public:', path.join(__dirname, 'public'));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/work-items', workItemRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器错误', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// 创建HTTP服务器
const server = http.createServer(app);

// 启动服务器函数
async function startServer() {
  try {
    console.log('正在启动服务器...');
    
    // 首先初始化数据库
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('数据库初始化失败，服务器无法启动');
      process.exit(1);
    }
    
    // 同步数据库模型 - 使用force: true强制重建表结构
    console.log('正在同步数据库模型...');
    
    // 仅在开发环境使用force:true，生产环境请勿使用
    if (process.env.NODE_ENV === 'development') {
      console.log('开发环境：强制重建数据库表...');
      
      // 1. 先同步所有模型，创建基础表结构
      await sequelize.sync({ force: true });
      console.log('基础表结构创建完成');
      
      // 2. 初始化基础数据
      await initializeData();
      
      // 3. 验证workitems表是否已创建
      const [workitemsExist] = await sequelize.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = 'project_management' 
        AND table_name = 'workitems'
      `);
      
      // 4. 仅在workitems表存在时创建workitem_activities表
      if (workitemsExist[0].count > 0) {
        console.log('检测到workitems表已存在，准备创建workitem_activities表');
        
        try {
          await sequelize.query(`
            CREATE TABLE IF NOT EXISTS workitem_activities (
              id INTEGER auto_increment,
              workItemId INTEGER NOT NULL,
              userId INTEGER NOT NULL,
              type ENUM('create', 'update', 'status_change', 'assignee_change', 'comment', 'attachment_add', 'attachment_delete') NOT NULL,
              field VARCHAR(255),
              oldValue TEXT,
              newValue TEXT, 
              description TEXT NOT NULL,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              FOREIGN KEY (workItemId) REFERENCES workitems(id) ON DELETE CASCADE,
              FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
          `);
          
          await sequelize.query(`
            ALTER TABLE workitem_activities 
            ADD INDEX workitem_activities_work_item_id (workItemId);
          `);
          
          console.log('成功创建workitem_activities表');
        } catch (error) {
          console.error('创建workitem_activities表失败:', error.message);
        }
      } else {
        console.log('workitems表不存在，跳过创建workitem_activities表');
      }
    } else {
      // 生产环境仅使用alter:true
      console.log('生产环境：更新数据库表结构...');
      await sequelize.sync({ alter: true });
    }
    
    console.log('数据库模型同步成功');
    
    // 启动 Express 服务器
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer(); 