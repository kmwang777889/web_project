import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Empty, Select, DatePicker, Space, Input, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  LineChartOutlined,
  PlusOutlined,
  ProjectOutlined,
  FilterOutlined,
  SearchOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { Bar } from '@ant-design/plots';
import dayjs from 'dayjs';
import api from '../utils/api';
import styled from 'styled-components';
import { renderPriorityTag, renderStatusTag, renderTypeTag } from '../utils/tagRenderers';

const { Option } = Select;
const { RangePicker } = DatePicker;

const StatisticCard = styled(Card)`
  height: 140px;
  border-radius: 8px;
  background: linear-gradient(to bottom right, #ffffff, #fafafa);
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .ant-card-body {
    padding: 20px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .statistic-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .statistic-title {
    color: rgba(0, 0, 0, 0.65);
    font-size: 15px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .statistic-icon {
    font-size: 20px;
    padding: 6px;
    border-radius: 6px;
  }

  .statistic-value {
    font-size: 32px;
    line-height: 1.2;
    font-weight: 600;
    color: #262626;
    margin: 8px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  }

  .statistic-description {
    color: rgba(0, 0, 0, 0.45);
    font-size: 13px;
    display: flex;
    gap: 12px;

    span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 4px;
    }
  }
`;

const Dashboard = () => {
  const [stats, setStats] = useState({
    completedCount: 0,
    pendingCount: 0,
    dailyAverage: 0,
    totalDueItems: 0
  });
  const [pendingItems, setPendingItems] = useState([]);
  const [filteredPendingItems, setFilteredPendingItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    projectId: '',
    brand: '',
    type: '',
    priority: '',
    createdById: '',
    assigneeId: '',
    dateRange: []
  });
  
  const navigate = useNavigate();
  
  // 获取统计数据
  const fetchStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };
  
  // 获取待处理工作项
  const fetchPendingItems = async () => {
    try {
      const data = await api.getPendingItems({ status: '待处理' });
      
      // 计算每个工作项从创建至今的天数
      const itemsWithDays = (data || []).map(item => {
        const createdDate = new Date(item.createdAt);
        const today = new Date();
        const diffTime = Math.abs(today - createdDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          ...item,
          daysFromCreation: diffDays
        };
      });
      
      setPendingItems(itemsWithDays);
      setFilteredPendingItems(itemsWithDays);
    } catch (error) {
      console.error('获取待处理工作项失败:', error);
      setPendingItems([]);
      setFilteredPendingItems([]);
    }
  };

  // 获取项目数据
  const fetchProjects = async () => {
    try {
      console.log('开始获取项目数据...');
      const data = await api.getProjects();
      console.log('获取项目数据成功:', data);
      
      // 确保data是一个数组，如果不是则使用空数组
      const projectsData = Array.isArray(data) ? data : [];
      
      // 为每个项目添加工作项数据，用于甘特图
      const projectsWithWorkItems = await Promise.all(
        projectsData.map(async (project) => {
          try {
            // 获取项目的工作项
            const workItems = await api.getWorkItems({ projectId: project.id });
            return {
              ...project,
              workItems: Array.isArray(workItems) ? workItems : []
            };
          } catch (error) {
            console.error(`获取项目 ${project.id} 的工作项失败:`, error);
            return {
              ...project,
              workItems: []
            };
          }
        })
      );
      
      setProjects(projectsWithWorkItems);
    } catch (error) {
      console.error('获取项目数据失败:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取用户数据
  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取用户数据失败:', error);
      setUsers([]);
    }
  };
  
  useEffect(() => {
    fetchStats();
    fetchPendingItems();
    fetchProjects();
    fetchUsers();
  }, []);
  
  // 当筛选条件变化时，过滤待处理工作项
  useEffect(() => {
    let filtered = [...pendingItems];
    
    // 按项目筛选
    if (filters.projectId) {
      filtered = filtered.filter(item => item.projectId === filters.projectId);
    }
    
    // 按品牌筛选 - 基于创建人的所属品牌
    if (filters.brand) {
      filtered = filtered.filter(item => {
        // 查找创建人信息
        const creator = users.find(user => user.id === item.createdById);
        return creator && creator.brand === filters.brand;
      });
    }
    
    // 按类型筛选
    if (filters.type) {
      filtered = filtered.filter(item => item.type === filters.type);
    }
    
    // 按紧急程度筛选
    if (filters.priority) {
      filtered = filtered.filter(item => item.priority === filters.priority);
    }
    
    // 按创建人筛选
    if (filters.createdById) {
      filtered = filtered.filter(item => item.createdById === filters.createdById);
    }
    
    // 按负责人筛选
    if (filters.assigneeId) {
      filtered = filtered.filter(item => item.assigneeId === filters.assigneeId);
    }
    
    // 按日期范围筛选
    if (filters.dateRange && filters.dateRange.length === 2) {
      const startDate = filters.dateRange[0].startOf('day');
      const endDate = filters.dateRange[1].endOf('day');
      
      filtered = filtered.filter(item => {
        const itemDate = dayjs(item.createdAt);
        return itemDate.isAfter(startDate) && itemDate.isBefore(endDate);
      });
    }
    
    setFilteredPendingItems(filtered);
  }, [filters, pendingItems, users]);
  
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
      projectId: '',
      brand: '',
      type: '',
      priority: '',
      createdById: '',
      assigneeId: '',
      dateRange: []
    });
  };

  // 待处理工作项表格列配置
  const columns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
      sortDirections: ['ascend', 'descend']
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
      sorter: (a, b) => a.title.localeCompare(b.title),
      sortDirections: ['ascend', 'descend'],
      render: (text, record) => (
        <Link to={`/work-items/${record.id}`}>{text}</Link>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
      render: (text) => text || '-'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      sorter: (a, b) => a.type.localeCompare(b.type),
      sortDirections: ['ascend', 'descend'],
      render: renderTypeTag
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: (a, b) => a.status.localeCompare(b.status),
      sortDirections: ['ascend', 'descend'],
      render: renderStatusTag
    },
    {
      title: '紧急程度',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      sorter: (a, b) => {
        const priorityOrder = { '紧急': 0, '高': 1, '中': 2, '低': 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      },
      sortDirections: ['ascend', 'descend'],
      render: renderPriorityTag
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      width: 120,
      sorter: (a, b) => {
        const aName = a.creator ? a.creator.username : '';
        const bName = b.creator ? b.creator.username : '';
        return aName.localeCompare(bName);
      },
      sortDirections: ['ascend', 'descend'],
      render: (creator) => creator?.username || '-'
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 120,
      sorter: (a, b) => {
        const aName = a.assignee ? a.assignee.username : '';
        const bName = b.assignee ? b.assignee.username : '';
        return aName.localeCompare(bName);
      },
      sortDirections: ['ascend', 'descend'],
      render: (assignee) => assignee?.username || '未分配'
    },
    {
      title: '创建日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      sortDirections: ['ascend', 'descend'],
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '创建距今天数',
      dataIndex: 'daysFromCreation',
      key: 'daysFromCreation',
      width: 120,
      render: (days) => <span style={{ color: days > 7 ? '#f5222d' : 'inherit' }}>{days} 天</span>
    }
  ];
  
  // 计算项目状态数量，确保数据存在
  const inProgressCount = projects && projects.length > 0 ? projects.filter(p => p.status === '进行中').length : 0;
  const completedCount = projects && projects.length > 0 ? projects.filter(p => p.status === '已完成').length : 0;
  
  // 计算工作项完成率，使用应完成工作项总数作为基数
  const completionRate = stats.totalDueItems > 0 ? Math.round((stats.completedCount / stats.totalDueItems) * 100) : 0;
  
  // 计算待处理工作项优先级数量，确保数据存在
  const urgentCount = pendingItems && pendingItems.length > 0 ? pendingItems.filter(i => i.priority === '紧急').length : 0;
  const highPriorityCount = pendingItems && pendingItems.length > 0 ? pendingItems.filter(i => i.priority === '高').length : 0;
  
  // 获取所有品牌
  const brands = [...new Set(users.map(user => user.brand).filter(Boolean))];
  
  return (
    <div className="dashboard">
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <StatisticCard>
            <div className="statistic-header">
              <div className="statistic-title">
                <ProjectOutlined 
                  className="statistic-icon" 
                  style={{ 
                    backgroundColor: '#e6f7ff',
                    color: '#1890ff'
                  }} 
                />
                <span>总项目数</span>
              </div>
            </div>
            <div className="statistic-value">{projects ? projects.length : 0}</div>
            <div className="statistic-description">
              <span>
                <i className="dot" style={{ backgroundColor: '#1890ff' }}></i>
                进行中：{inProgressCount}
              </span>
              <span>
                <i className="dot" style={{ backgroundColor: '#52c41a' }}></i>
                已完成：{completedCount}
              </span>
            </div>
          </StatisticCard>
        </Col>
        <Col span={8}>
          <StatisticCard>
            <div className="statistic-header">
              <div className="statistic-title">
                <CheckCircleOutlined 
                  className="statistic-icon" 
                  style={{ 
                    backgroundColor: '#f6ffed',
                    color: '#52c41a'
                  }} 
                />
                <span>工作项完成率</span>
              </div>
            </div>
            <div className="statistic-value">
              {completionRate}%
            </div>
            <div className="statistic-description">
              <span>
                <i className="dot" style={{ backgroundColor: '#52c41a' }}></i>
                已完成：{stats.completedCount || 0}
              </span>
              <span>
                <i className="dot" style={{ backgroundColor: '#8c8c8c' }}></i>
                应完成：{stats.totalDueItems || 0}
              </span>
            </div>
          </StatisticCard>
        </Col>
        <Col span={8}>
          <StatisticCard>
            <div className="statistic-header">
              <div className="statistic-title">
                <ClockCircleOutlined 
                  className="statistic-icon" 
                  style={{ 
                    backgroundColor: '#fff7e6',
                    color: '#fa8c16'
                  }} 
                />
                <span>待处理工作项</span>
              </div>
            </div>
            <div className="statistic-value">{stats.pendingCount || 0}</div>
            <div className="statistic-description">
              <span>
                <i className="dot" style={{ backgroundColor: '#f5222d' }}></i>
                紧急：{urgentCount}
              </span>
              <span>
                <i className="dot" style={{ backgroundColor: '#fa8c16' }}></i>
                高优先级：{highPriorityCount}
              </span>
            </div>
          </StatisticCard>
        </Col>
      </Row>

      {/* 待处理工作项 */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>待处理工作项</span>
            <Button 
              type="link" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/projects?tab=workItems')}
            >
              返回工作项列表
            </Button>
          </div>
        }
        style={{ marginBottom: 24 }}
        bodyStyle={{ padding: '16px 24px' }}
      >
        {/* 筛选器 */}
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Select
            placeholder="项目"
            style={{ width: 150 }}
            value={filters.projectId || undefined}
            onChange={(value) => handleFilterChange('projectId', value)}
            allowClear
          >
            {projects.map(project => (
              <Option key={project.id} value={project.id}>{project.name}</Option>
            ))}
          </Select>
          
          <Select
            placeholder="品牌"
            style={{ width: 150 }}
            value={filters.brand || undefined}
            onChange={(value) => handleFilterChange('brand', value)}
            allowClear
          >
            {brands.map(brand => (
              <Option key={brand} value={brand}>{brand}</Option>
            ))}
          </Select>
          
          <Select
            placeholder="类型"
            style={{ width: 150 }}
            value={filters.type || undefined}
            onChange={(value) => handleFilterChange('type', value)}
            allowClear
          >
            <Option value="规划">规划</Option>
            <Option value="需求">需求</Option>
            <Option value="事务">事务</Option>
            <Option value="缺陷">缺陷</Option>
          </Select>
          
          <Select
            placeholder="紧急程度"
            style={{ width: 150 }}
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
            placeholder="创建人"
            style={{ width: 150 }}
            value={filters.createdById || undefined}
            onChange={(value) => handleFilterChange('createdById', value)}
            allowClear
          >
            {users.map(user => (
              <Option key={user.id} value={user.id}>{user.username}</Option>
            ))}
          </Select>
          
          <Select
            placeholder="负责人"
            style={{ width: 150 }}
            value={filters.assigneeId || undefined}
            onChange={(value) => handleFilterChange('assigneeId', value)}
            allowClear
          >
            {users.map(user => (
              <Option key={user.id} value={user.id}>{user.username}</Option>
            ))}
          </Select>
          
          <RangePicker
            style={{ width: 250 }}
            value={filters.dateRange}
            onChange={(dates) => handleFilterChange('dateRange', dates)}
          />
          
          <Button 
            icon={<FilterOutlined />} 
            onClick={resetFilters}
          >
            重置筛选
          </Button>
        </div>
        
        {filteredPendingItems && filteredPendingItems.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredPendingItems}
            rowKey="id"
            pagination={{ pageSize: 5 }}
            size="middle"
            scroll={{ x: 1300 }}
            bordered
          />
        ) : (
          <Empty description="暂无待处理工作项" />
        )}
      </Card>

      {/* 项目进度 */}
      <Card 
        title="项目进度"
        bodyStyle={{ padding: '16px 24px' }}
      >
        {projects && projects.length > 0 ? (
          <div style={{ height: 400, width: '100%' }}>
            <ProjectGanttChart projects={projects} />
          </div>
        ) : (
          <Empty description="暂无项目" />
        )}
      </Card>
    </div>
  );
};

// 项目甘特图组件 - 使用 Bar 组件模拟甘特图
const ProjectGanttChart = ({ projects }) => {
  // 状态管理
  const [selectedProject, setSelectedProject] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  
  // 准备甘特图数据
  const prepareGanttData = () => {
    const ganttData = [];
    const today = dayjs().startOf('day');
    
    // 获取所有日期的范围，用于设置x轴
    let minDate = null;
    let maxDate = null;
    
    projects.forEach(project => {
      // 跳过不匹配的项目
      if (selectedProject && project.id !== selectedProject) {
        return;
      }
      
      // 只添加工作项，不添加项目
      if (project.workItems && project.workItems.length > 0) {
        project.workItems.forEach(item => {
          if (item.scheduledStartDate && item.scheduledEndDate) {
            // 使用startOf('day')确保开始日期从当天的开始计算
            const startDate = dayjs(item.scheduledStartDate).startOf('day');
            
            // 关键修改：使用endOf('day')确保结束日期包含整天
            // 这样即使开始日期和结束日期是同一天，也会显示为一整天的长度
            const endDate = dayjs(item.scheduledEndDate).endOf('day');
            
            // 如果设置了日期范围筛选，则跳过不在范围内的工作项
            if (dateRange[0] && dateRange[1]) {
              const filterStartDate = dayjs(dateRange[0]).startOf('day');
              const filterEndDate = dayjs(dateRange[1]).endOf('day');
              
              // 如果工作项的时间范围与筛选范围没有交集，则跳过
              if (endDate.isBefore(filterStartDate) || startDate.isAfter(filterEndDate)) {
                return;
              }
            }
            
            // 更新日期范围
            if (!minDate || startDate.isBefore(minDate)) {
              minDate = startDate;
            }
            if (!maxDate || endDate.isAfter(maxDate)) {
              maxDate = endDate;
            }
            
            // 计算工作项的进度状态
            let progressStatus = item.status;
            if (item.status === '待处理' && startDate.isBefore(today)) {
              progressStatus = '已延期';
            }
            
            ganttData.push({
              name: item.title,
              project: project.name, // 添加项目名称，用于显示
              type: item.type,
              // 使用ISO格式的日期字符串，确保精确到毫秒
              startDate: startDate.format('YYYY-MM-DD'),
              endDate: endDate.format('YYYY-MM-DD'),
              status: progressStatus,
              category: 'workitem'
            });
          }
        });
      }
    });
    
    // 按开始时间排序
    ganttData.sort((a, b) => dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf());
    
    // 如果没有数据，返回空数组和默认日期范围
    if (ganttData.length === 0) {
      return {
        data: [],
        minDate: today.format('YYYY-MM-DD'),
        maxDate: today.add(15, 'day').format('YYYY-MM-DD')
      };
    }
    
    // 确保日期范围至少有15天，以便更好地显示
    if (minDate && maxDate) {
      const diffDays = maxDate.diff(minDate, 'day');
      if (diffDays < 15) {
        maxDate = minDate.add(15, 'day');
      }
    }
    
    return {
      data: ganttData,
      minDate: minDate ? minDate.format('YYYY-MM-DD') : today.format('YYYY-MM-DD'),
      maxDate: maxDate ? maxDate.format('YYYY-MM-DD') : today.add(15, 'day').format('YYYY-MM-DD')
    };
  };
  
  const { data: ganttData, minDate, maxDate } = prepareGanttData();
  
  // 如果没有有效的甘特图数据，显示提示信息
  if (ganttData.length === 0) {
    return (
      <>
        {/* 筛选器 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          <Select
            placeholder="选择项目"
            style={{ width: 200 }}
            value={selectedProject || undefined}
            onChange={setSelectedProject}
            allowClear
          >
            {projects.map(project => (
              <Select.Option key={project.id} value={project.id}>{project.name}</Select.Option>
            ))}
          </Select>
          
          <DatePicker.RangePicker
            placeholder={['开始日期', '结束日期']}
            value={dateRange}
            onChange={setDateRange}
            style={{ width: 300 }}
          />
        </div>
        <Empty description="暂无排期数据" />
      </>
    );
  }
  
  // 获取状态颜色
  const getStatusColor = (status) => {
    if (status === '已完成') return '#52c41a';
    if (status === '进行中') return '#1890ff';
    if (status === '待处理') return '#faad14';
    if (status === '已延期') return '#f5222d';
    return '#d9d9d9';
  };
  
  // 转换数据为甘特图所需格式
  const convertedData = ganttData.map(item => {
    // 计算实际的日期范围，确保即使是同一天也能正确显示
    const start = dayjs(item.startDate).startOf('day');
    const end = dayjs(item.endDate).endOf('day');
    
    return {
      ...item,
      // 使用ISO格式的日期字符串，确保精确到毫秒
      range: [start.toISOString(), end.toISOString()]
    };
  });
  
  // 甘特图配置
  const config = {
    data: convertedData,
    xField: 'range',
    yField: 'name',
    isRange: true,
    seriesField: 'status',
    height: 400,
    legend: {
      position: 'top-right',
    },
    label: false,
    tooltip: {
      customContent: (title, items) => {
        // 完全自定义tooltip内容
        const item = items[0]; // 获取第一个数据项
        if (!item) return '';
        
        const datum = item.data;
        // 计算持续天数，加1确保同一天显示为1天
        const startDate = dayjs(datum.startDate);
        const endDate = dayjs(datum.endDate);
        const duration = endDate.diff(startDate, 'day') + 1;
        
        // 返回带有标签的文本
        return `
          <div style="padding: 5px; font-size: 12px; line-height: 1.5;">
            <div><strong>${datum.name}</strong></div>
            <div>项目: ${datum.project}</div>
            <div>类型: ${datum.type}</div>
            <div>状态: ${datum.status}</div>
            <div>开始日期: ${startDate.format('YYYY-MM-DD')}</div>
            <div>结束日期: ${endDate.format('YYYY-MM-DD')}</div>
            <div>持续天数: ${duration} 天</div>
          </div>
        `;
      },
      showTitle: false,
      showMarkers: false,
    },
    color: ({ status }) => getStatusColor(status),
    barStyle: {
      radius: 4,
      fillOpacity: 0.8,
    },
    // 添加边距配置，确保坐标轴完全显示
    padding: [40, 40, 120, 200], // 上、右、下、左的边距
    // 调整x轴配置
    xAxis: {
      type: 'time',
      tickCount: 10,
      min: minDate,
      max: maxDate,
      label: {
        formatter: (text) => dayjs(text).format('MM-DD'),
        style: {
          fontSize: 12, // 与Y轴保持一致的字体大小
          fontWeight: 400, // 与Y轴保持一致的字体粗细
        },
      },
      grid: {
        line: {
          style: {
            stroke: '#f0f0f0', // 显示网格线，帮助区分日期
          },
        },
      },
    },
    // 添加y轴配置，减小字体大小
    yAxis: {
      label: {
        autoHide: false,
        autoEllipsis: false,
        style: {
          fontSize: 12, // 减小字体大小
          fontWeight: 400, // 减轻字体粗细
        },
        formatter: (text) => {
          if (text.length > 30) {
            return text.substring(0, 30) + '...';
          }
          return text;
        },
      },
      grid: {
        line: {
          style: {
            stroke: 'transparent',
          },
        },
      },
    },
    meta: {
      range: {
        type: 'time',
        mask: 'YYYY-MM-DD',
        tickInterval: 86400000, // 一天的毫秒数，确保每天显示一个刻度
        nice: true,
        // 添加自定义的日期解析和格式化函数
        formatter: (value) => {
          return dayjs(value).format('YYYY-MM-DD');
        },
        parser: (value) => {
          return dayjs(value).valueOf();
        }
      },
    },
  };
  
  return (
    <>
      {/* 筛选器 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <Select
          placeholder="选择项目"
          style={{ width: 200 }}
          value={selectedProject || undefined}
          onChange={setSelectedProject}
          allowClear
        >
          {projects.map(project => (
            <Select.Option key={project.id} value={project.id}>{project.name}</Select.Option>
          ))}
        </Select>
        
        <DatePicker.RangePicker
          placeholder={['开始日期', '结束日期']}
          value={dateRange}
          onChange={setDateRange}
          style={{ width: 300 }}
        />
        
        <Button 
          onClick={() => {
            setSelectedProject('');
            setDateRange([null, null]);
          }}
          icon={<FilterOutlined />}
        >
          重置筛选
        </Button>
      </div>
      
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.45)', marginBottom: 8 }}>
          工作项排期时间。
        </div>
      </div>
      
      {/* 设置容器样式，确保内容不会溢出 */}
      <div style={{ 
        width: '100%', 
        overflowX: 'auto', 
        overflowY: 'hidden',
        marginBottom: '24px'
      }}>
        <div style={{ 
          minWidth: '800px',
          width: '100%', 
          padding: '0 0 30px 0', // 底部增加额外的padding
          position: 'relative'
        }}>
          <Bar 
            {...config} 
            onReady={(plot) => {
              // 不做额外的大小调整，使用默认配置
              console.log('图表已加载');
            }}
          />
        </div>
      </div>
    </>
  );
};

export default Dashboard; 