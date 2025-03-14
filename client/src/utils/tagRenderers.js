import React from 'react';

// 优先级标签渲染
export const renderPriorityTag = (priority) => {
  let color = '';
  switch (priority) {
    case '紧急':
      color = 'priority-urgent';
      break;
    case '高':
      color = 'priority-high';
      break;
    case '中':
      color = 'priority-medium';
      break;
    case '低':
      color = 'priority-low';
      break;
    default:
      color = 'priority-medium';
  }
  return <span className={`priority-tag ${color}`}>{priority}</span>;
};

// 状态标签渲染
export const renderStatusTag = (status) => {
  let className = '';
  switch (status) {
    case '待处理':
      className = 'status-pending';
      break;
    case '进行中':
      className = 'status-in-progress';
      break;
    case '已完成':
      className = 'status-completed';
      break;
    case '关闭':
      className = 'status-closed';
      break;
    default:
      className = 'status-pending';
  }
  return <span className={`status-tag ${className}`}>{status}</span>;
};

// 类型标签渲染
export const renderTypeTag = (type) => {
  let className = '';
  switch (type) {
    case '规划':
      className = 'type-planning';
      break;
    case '需求':
      className = 'type-requirement';
      break;
    case '事务':
      className = 'type-task';
      break;
    case '缺陷':
      className = 'type-bug';
      break;
    default:
      className = 'type-task';
  }
  return <span className={`type-tag ${className}`}>{type}</span>;
}; 