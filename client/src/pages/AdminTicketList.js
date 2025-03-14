import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Input, 
  Select, 
  Tag, 
  message, 
  Spin,
  Tabs,
  Tooltip,
  DatePicker,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined,
  FilterOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import dayjs from 'dayjs';
import { renderPriorityTag, renderStatusTag } from '../utils/tagRenderers';

const { Option } = Select;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

const AdminTicketList = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [users, setUsers] = useState([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    closed: 0,
    urgent: 0
  });
  
  // 筛选条件
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    createdById: '',
    assigneeId: '',
    startDate: '',
    endDate: ''
  });
  
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // 获取工单列表 - 使用 useCallback 包装以避免依赖循环
  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      
      // 根据当前标签页设置筛选条件
      let queryParams = { ...filters };
      if (activeTab === 'assigned') {
        queryParams.assigneeId = currentUser.id;
      } else if (activeTab === 'unassigned') {
        queryParams.unassigned = true;
      }
      
      const data = await api.getTickets(queryParams);
      setTickets(data);
      
      // 计算统计数据
      const stats = {
        total: data.length,
        pending: data.filter(ticket => ticket.status === '待处理').length,
        inProgress: data.filter(ticket => ticket.status === '进行中').length,
        completed: data.filter(ticket => ticket.status === '已完成').length,
        closed: data.filter(ticket => ticket.status === '关闭').length,
        urgent: data.filter(ticket => ticket.priority === '紧急').length
      };
      setStatistics(stats);
    } catch (error) {
      console.error('获取工单列表失败:', error);
      message.error('获取工单列表失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, currentUser]);
  
  // 获取用户列表
  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchTickets();
    fetchUsers();
  }, [fetchTickets]);
  
  // 处理筛选条件变化
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 处理日期范围变化
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD')
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        startDate: '',
        endDate: ''
      }));
    }
  };
  
  // 重置筛选条件
  const resetFilters = () => {
    setFilters({
      search: '',
      status: '',
      priority: '',
      createdById: '',
      assigneeId: '',
      startDate: '',
      endDate: ''
    });
  };
  
  // 处理标签页切换
  const handleTabChange = (key) => {
    setActiveTab(key);
    // 重置筛选条件
    resetFilters();
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
      render: (assignee) => assignee ? (
        <Tooltip title={`${assignee.username} (${assignee.role === 'super_admin' ? '超级管理员' : '管理员'})`}>
          <Tag icon={<UserOutlined />} color="blue">{assignee.username}</Tag>
        </Tooltip>
      ) : (
        <Tag color="default">未分配</Tag>
      )
    },
    {
      title: '创建者',
      dataIndex: 'creator',
      key: 'creator',
      width: 120,
      render: (creator) => creator ? (
        <Tooltip title={creator.role === 'user' ? '普通用户' : (creator.role === 'admin' ? '管理员' : '超级管理员')}>
          <Tag icon={<UserOutlined />} color={creator.role === 'user' ? 'default' : 'purple'}>
            {creator.username}
          </Tag>
        </Tooltip>
      ) : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          {dayjs(date).format('YYYY-MM-DD HH:mm')}
        </Tooltip>
      ),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    },
    {
      title: '评论数',
      dataIndex: 'comments',
      key: 'comments',
      width: 80,
      render: (comments) => comments ? comments.length : 0,
      sorter: (a, b) => (a.comments ? a.comments.length : 0) - (b.comments ? b.comments.length : 0)
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
  
  // 如果不是管理员，重定向到首页
  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <div>
      <h1>工单管理中心</h1>
      
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic 
              title="总工单数" 
              value={statistics.total} 
              prefix={<ClockCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="待处理" 
              value={statistics.pending} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="进行中" 
              value={statistics.inProgress} 
              valueStyle={{ color: '#722ed1' }}
              prefix={<ClockCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="已完成" 
              value={statistics.completed} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="已关闭" 
              value={statistics.closed} 
              valueStyle={{ color: '#d9d9d9' }}
              prefix={<CloseCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="紧急工单" 
              value={statistics.urgent} 
              valueStyle={{ color: '#f5222d' }}
              prefix={<ExclamationCircleOutlined />} 
            />
          </Card>
        </Col>
      </Row>
      
      {/* 筛选器 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
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
          <Select
            placeholder="创建者"
            style={{ width: 150 }}
            value={filters.createdById || undefined}
            onChange={(value) => handleFilterChange('createdById', value)}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {users.map(user => (
              <Option key={user.id} value={user.id}>
                {user.username} ({user.role === 'user' ? '用户' : (user.role === 'admin' ? '管理员' : '超级管理员')})
              </Option>
            ))}
          </Select>
          <Select
            placeholder="负责人"
            style={{ width: 150 }}
            value={filters.assigneeId || undefined}
            onChange={(value) => handleFilterChange('assigneeId', value)}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {users.filter(user => user.role === 'admin' || user.role === 'super_admin').map(admin => (
              <Option key={admin.id} value={admin.id}>
                {admin.username} ({admin.role === 'super_admin' ? '超级管理员' : '管理员'})
              </Option>
            ))}
          </Select>
          <RangePicker 
            placeholder={['开始日期', '结束日期']}
            onChange={handleDateRangeChange}
            style={{ width: 240 }}
          />
          <Button 
            icon={<FilterOutlined />} 
            onClick={resetFilters}
          >
            重置筛选
          </Button>
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
                pagination={{ 
                  pageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                  showTotal: total => `共 ${total} 条记录`
                }}
              />
            </Spin>
          </TabPane>
          
          <TabPane tab="分配给我的" key="assigned">
            <Spin spinning={loading}>
              <Table
                columns={columns}
                dataSource={tickets}
                rowKey="id"
                pagination={{ 
                  pageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                  showTotal: total => `共 ${total} 条记录`
                }}
              />
            </Spin>
          </TabPane>
          
          <TabPane tab="未分配" key="unassigned">
            <Spin spinning={loading}>
              <Table
                columns={columns}
                dataSource={tickets}
                rowKey="id"
                pagination={{ 
                  pageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                  showTotal: total => `共 ${total} 条记录`
                }}
              />
            </Spin>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default AdminTicketList; 