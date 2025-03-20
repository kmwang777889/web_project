import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Tag, 
  Space, 
  Typography, 
  Modal, 
  message, 
  Tooltip,
  Spin,
  Badge
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  QuestionCircleOutlined, 
  CalendarOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const UserApproval = () => {
  const { getPendingUsers, approveUser } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  
  // 获取待审核用户列表
  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const users = await getPendingUsers();
      setPendingUsers(users || []);
    } catch (error) {
      console.error('获取待审核用户失败:', error);
      message.error('获取待审核用户失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 组件加载时获取待审核用户
  useEffect(() => {
    fetchPendingUsers();
  }, []);
  
  // 处理用户审核
  const handleApproveUser = async (userId, approved) => {
    try {
      setApproving(true);
      const status = approved ? 'approved' : 'rejected';
      await approveUser(userId, status);
      
      message.success(approved ? '已批准用户注册' : '已拒绝用户注册');
      
      // 刷新用户列表
      fetchPendingUsers();
    } catch (error) {
      console.error('审核用户失败:', error);
      message.error('审核用户失败: ' + error.message);
    } finally {
      setApproving(false);
    }
  };
  
  // 确认审核操作
  const confirmUserApproval = (user, approved) => {
    Modal.confirm({
      title: approved ? '确认批准用户注册' : '确认拒绝用户注册',
      content: (
        <div>
          <p>您确定要{approved ? '批准' : '拒绝'}以下用户的注册申请吗？</p>
          <p><strong>用户名:</strong> {user.username}</p>
          <p><strong>手机号:</strong> {user.phone}</p>
          <p><strong>所属品牌:</strong> {user.brand}</p>
        </div>
      ),
      onOk: () => handleApproveUser(user.id, approved),
      okText: approved ? '批准' : '拒绝',
      cancelText: '取消',
      okButtonProps: { 
        type: approved ? 'primary' : 'danger',
        loading: approving
      }
    });
  };
  
  // 表格列定义
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text) => (
        <Space>
          <UserOutlined />
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: '所属品牌',
      dataIndex: 'brand',
      key: 'brand',
      render: (brand) => <Tag color="blue">{brand}</Tag>
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Space>
            <CalendarOutlined />
            {dayjs(date).format('YYYY-MM-DD')}
          </Space>
        </Tooltip>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color, icon, text;
        
        switch (status) {
          case 'pending':
            color = 'warning';
            icon = <QuestionCircleOutlined />;
            text = '待审核';
            break;
          case 'approved':
            color = 'success';
            icon = <CheckCircleOutlined />;
            text = '已批准';
            break;
          case 'rejected':
            color = 'error';
            icon = <CloseCircleOutlined />;
            text = '已拒绝';
            break;
          default:
            color = 'default';
            text = status;
        }
        
        return <Badge status={color} text={text} />;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            icon={<CheckCircleOutlined />} 
            onClick={() => confirmUserApproval(record, true)}
            disabled={record.status !== 'pending'}
          >
            批准
          </Button>
          <Button 
            danger 
            icon={<CloseCircleOutlined />} 
            onClick={() => confirmUserApproval(record, false)}
            disabled={record.status !== 'pending'}
          >
            拒绝
          </Button>
        </Space>
      )
    }
  ];
  
  return (
    <Card title={<Title level={4}>用户注册审核</Title>}>
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={fetchPendingUsers} disabled={loading}>
            刷新列表
          </Button>
          <Text style={{ marginLeft: 16 }}>
            {pendingUsers.length > 0 
              ? `共有 ${pendingUsers.length} 条待审核记录` 
              : '暂无待审核用户'}
          </Text>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={pendingUsers.map(user => ({ ...user, key: user.id }))} 
          pagination={{ 
            pageSize: 10, 
            showTotal: (total) => `共 ${total} 条记录`
          }} 
        />
      </Spin>
    </Card>
  );
};

export default UserApproval; 