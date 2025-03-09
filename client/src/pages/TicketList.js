import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Input, 
  Select, 
  Tag, 
  Space, 
  message, 
  Spin,
  Tabs
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const { Option } = Select;
const { TabPane } = Tabs;

// 优先级标签渲染
const renderPriorityTag = (priority) => {
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
  return <Tag className={`priority-tag ${color}`}>{priority}</Tag>;
};

// 状态标签渲染
const renderStatusTag = (status) => {
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
  return <Tag className={`status-tag ${className}`}>{status}</Tag>;
};

const TicketList = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // 筛选条件
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    assigned: false
  });
  
  // 获取工单列表
  const fetchTickets = async () => {
    try {
      setLoading(true);
      
      // 根据当前标签页设置筛选条件
      let queryParams = { ...filters };
      if (activeTab === 'assigned') {
        queryParams.assigned = true;
      }
      
      const data = await api.getTickets(queryParams);
      setTickets(data);
    } catch (error) {
      console.error('获取工单列表失败:', error);
      message.error('获取工单列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchTickets();
  }, []);
  
  // 当筛选条件或标签页变化时重新获取数据
  useEffect(() => {
    fetchTickets();
  }, [filters, activeTab]);
  
  // 处理筛选条件变化
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 重置筛选条件
  const resetFilters = () => {
    setFilters({
      search: '',
      status: '',
      priority: '',
      assigned: activeTab === 'assigned'
    });
  };
  
  // 处理标签页切换
  const handleTabChange = (key) => {
    setActiveTab(key);
    setFilters(prev => ({
      ...prev,
      assigned: key === 'assigned'
    }));
  };
  
  // 表格列定义
  const columns = [
    {
      title: '工单编号',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      width: 150,
      render: (text, record) => (
        <Link to={`/tickets/${record.id}`}>{text}</Link>
      )
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Link to={`/tickets/${record.id}`}>{text}</Link>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderStatusTag
    },
    {
      title: '紧急程度',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: renderPriorityTag
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 120,
      render: (assignee) => assignee ? assignee.username : '未分配'
    },
    {
      title: '创建者',
      dataIndex: 'creator',
      key: 'creator',
      width: 120,
      render: (creator) => creator ? creator.username : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          icon={<EyeOutlined />} 
          size="small"
          onClick={() => navigate(`/tickets/${record.id}`)}
        />
      )
    }
  ];
  
  return (
    <div>
      <h1>工单管理</h1>
      
      {/* 筛选器 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Input
              placeholder="搜索工单标题"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              value={filters.status || undefined}
              onChange={(value) => handleFilterChange('status', value)}
              allowClear
            >
              <Option value="待处理">待处理</Option>
              <Option value="进行中">进行中</Option>
              <Option value="已完成">已完成</Option>
              <Option value="关闭">关闭</Option>
            </Select>
            <Select
              placeholder="紧急程度"
              style={{ width: 120 }}
              value={filters.priority || undefined}
              onChange={(value) => handleFilterChange('priority', value)}
              allowClear
            >
              <Option value="紧急">紧急</Option>
              <Option value="高">高</Option>
              <Option value="中">中</Option>
              <Option value="低">低</Option>
            </Select>
            <Button 
              icon={<FilterOutlined />} 
              onClick={resetFilters}
            >
              重置筛选
            </Button>
          </div>
        </div>
      </Card>
      
      {/* 工单列表 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane tab="全部工单" key="all">
            <Spin spinning={loading}>
              <Table
                columns={columns}
                dataSource={tickets}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            </Spin>
          </TabPane>
          
          {isAdmin() && (
            <TabPane tab="分配给我的" key="assigned">
              <Spin spinning={loading}>
                <Table
                  columns={columns}
                  dataSource={tickets}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </Spin>
            </TabPane>
          )}
        </Tabs>
      </Card>
    </div>
  );
};

export default TicketList; 