const { sequelize } = require('../config/database');
const User = require('../models/User');

/**
 * 初始化基础数据
 */
async function initializeData() {
  try {
    console.log('开始初始化基础数据...');
    
    // 1. 创建默认管理员用户
    try {
      const adminExists = await User.findOne({ where: { username: 'admin' } });
      
      if (!adminExists) {
        await User.create({
          username: 'admin',
          password: 'admin123', // 密码会自动通过hooks进行哈希处理
          phone: '13800000000',
          brand: 'EL',
          role: 'super_admin',
          status: 'approved'
        });
        console.log('创建超级管理员成功: admin/admin123');
      } else {
        console.log('超级管理员已存在，无需创建');
      }
    } catch (error) {
      console.error('创建超级管理员失败:', error);
    }
    
    // 2. 创建测试用户
    try {
      const testUserExists = await User.findOne({ where: { username: 'test' } });
      
      if (!testUserExists) {
        await User.create({
          username: 'test',
          password: 'test123',
          phone: '13811111111',
          brand: 'MAC',
          role: 'user',
          status: 'approved'
        });
        console.log('创建测试用户成功: test/test123');
      } else {
        console.log('测试用户已存在，无需创建');
      }
    } catch (error) {
      console.error('创建测试用户失败:', error);
    }
    
    console.log('基础数据初始化完成');
  } catch (error) {
    console.error('初始化基础数据失败:', error);
  }
}

// 如果直接运行此脚本则执行初始化
if (require.main === module) {
  initializeData()
    .then(() => {
      console.log('数据初始化完成，退出进程');
      process.exit(0);
    })
    .catch(error => {
      console.error('数据初始化失败:', error);
      process.exit(1);
    });
}

module.exports = initializeData; 