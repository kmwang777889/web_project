const jwt = require('jsonwebtoken');
const { User } = require('../models');

// 验证JWT令牌
exports.authenticate = async (req, res, next) => {
  try {
    // 从请求头获取令牌
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: '未提供认证令牌' });
    }
    
    // 验证令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 查找用户
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }
    
    // 将用户信息添加到请求对象
    req.user = user;
    next();
  } catch (error) {
    console.error('认证错误:', error);
    res.status(401).json({ message: '认证失败' });
  }
};

// 检查用户是否为管理员
exports.isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ message: '需要管理员权限' });
  }
};

// 检查用户是否为超级管理员
exports.isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    next();
  } else {
    res.status(403).json({ message: '需要超级管理员权限' });
  }
};

// 检查用户是否为资源创建者或管理员
exports.isCreatorOrAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resourceType = req.baseUrl.split('/').pop();
    let resource;
    
    // 根据资源类型获取对应的模型
    switch (resourceType) {
      case 'projects':
        resource = await require('../models').Project.findByPk(id);
        break;
      case 'work-items':
        resource = await require('../models').WorkItem.findByPk(id);
        break;
      case 'tickets':
        resource = await require('../models').Ticket.findByPk(id);
        break;
      default:
        return res.status(400).json({ message: '无效的资源类型' });
    }
    
    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }
    
    // 检查用户是否为创建者或管理员
    if (
      resource.createdById === req.user.id || 
      req.user.role === 'admin' || 
      req.user.role === 'super_admin'
    ) {
      next();
    } else {
      res.status(403).json({ message: '没有权限修改此资源' });
    }
  } catch (error) {
    console.error('权限检查错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
}; 