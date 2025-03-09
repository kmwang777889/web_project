import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Avatar, 
  Button, 
  Form, 
  Input, 
  Select, 
  Upload, 
  message, 
  Tabs, 
  Modal,
  Spin,
  Typography
} from 'antd';
import { 
  UserOutlined, 
  UploadOutlined, 
  LockOutlined,
  LoadingOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const ProfileCard = styled(Card)`
  max-width: 600px;
  margin: 0 auto;
  
  .avatar-uploader {
    display: flex;
    justify-content: center;
    margin-bottom: 24px;
    
    .ant-upload {
      width: 128px;
      height: 128px;
      border-radius: 50% !important;
      overflow: hidden;
      cursor: pointer;
      
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }
      
      .ant-upload-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(0, 0, 0, 0.45);
      }
    }
  }
`;

// 添加全局样式覆盖
const GlobalStyle = styled.div`
  .ant-upload.ant-upload-select-picture-card {
    border-radius: 50% !important;
    width: 128px !important;
    height: 128px !important;
    margin: 0 !important;
    border: 1px dashed #d9d9d9 !important;
    background-color: #fafafa !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    overflow: hidden !important;
  }
  
  .ant-upload-list-picture-card-container {
    width: 128px !important;
    height: 128px !important;
    border-radius: 50% !important;
    margin: 0 !important;
  }
`;

const AvatarWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
  
  .avatar-container {
    width: 128px;
    height: 128px;
    border-radius: 50%;
    overflow: hidden;
    position: relative;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .avatar-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      opacity: 0;
      transition: opacity 0.3s;
      color: white;
      
      &:hover {
        opacity: 1;
      }
      
      .anticon {
        font-size: 24px;
        margin-bottom: 8px;
      }
    }
  }
`;

const Profile = () => {
  const { currentUser, updateUserInfo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [imageUrl, setImageUrl] = useState(currentUser?.avatar || '');
  
  // 初始化表单数据
  useEffect(() => {
    if (currentUser) {
      profileForm.setFieldsValue({
        username: currentUser.username,
        phone: currentUser.phone,
        brand: currentUser.brand
      });
      setImageUrl(currentUser.avatar || '');
    }
  }, [currentUser, profileForm]);
  
  // 更新个人资料
  const handleProfileUpdate = async (values) => {
    try {
      setLoading(true);
      const response = await api.updateUser(currentUser.id, values);
      updateUserInfo(response.user);
      message.success('个人资料更新成功');
    } catch (error) {
      console.error('更新个人资料失败:', error);
      message.error('更新个人资料失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 上传头像
  const handleAvatarUpload = async (info) => {
    if (info.file.status === 'uploading') {
      setUploadLoading(true);
      return;
    }
    
    if (info.file.status === 'done') {
      setUploadLoading(false);
      message.success('头像上传成功');
      
      // 更新用户信息
      if (info.file.response && info.file.response.user) {
        updateUserInfo(info.file.response.user);
      }
    } else if (info.file.status === 'error') {
      setUploadLoading(false);
      message.error('头像上传失败');
    }
  };
  
  // 自定义上传请求
  const customUploadRequest = async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await api.updateUser(currentUser.id, formData);
      onSuccess(response, file);
    } catch (error) {
      console.error('上传头像失败:', error);
      onError(error);
    }
  };
  
  // 打开修改密码模态框
  const showPasswordModal = () => {
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };
  
  // 关闭修改密码模态框
  const handlePasswordCancel = () => {
    setPasswordModalVisible(false);
  };
  
  // 提交修改密码
  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      
      setLoading(true);
      await api.updatePassword(currentUser.id, values);
      message.success('密码修改成功');
      
      setPasswordModalVisible(false);
    } catch (error) {
      console.error('修改密码失败:', error);
      message.error('修改密码失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const beforeUpload = (file) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('只能上传 JPG/PNG 格式的图片！');
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过 2MB！');
    }
    return isJpgOrPng && isLt2M;
  };

  const handleChange = async (info) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }
    
    if (info.file.status === 'done') {
      setLoading(false);
      const avatarUrl = info.file.response.url;
      setImageUrl(avatarUrl);
      
      // 更新用户信息中的头像
      try {
        await api.updateProfile({ avatar: avatarUrl });
        updateUserInfo({ ...currentUser, avatar: avatarUrl });
        message.success('头像更新成功！');
      } catch (error) {
        console.error('更新头像失败:', error);
        message.error('更新头像失败，请重试');
      }
    }
  };
  
  if (!currentUser) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }
  
  return (
    <div className="profile-container">
      <GlobalStyle />
      <ProfileCard title="个人资料">
        <AvatarWrapper>
          <div className="avatar-container">
            {imageUrl ? (
              <>
                <img src={imageUrl} alt="avatar" />
                <div className="avatar-overlay" onClick={() => document.getElementById('avatar-upload').click()}>
                  <UploadOutlined />
                  <span>更换头像</span>
                </div>
              </>
            ) : (
              <div 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: '#fafafa',
                  border: '1px dashed #d9d9d9',
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
                onClick={() => document.getElementById('avatar-upload').click()}
              >
                {loading ? <LoadingOutlined /> : <PlusOutlined />}
                <div style={{ marginTop: 8 }}>上传头像</div>
              </div>
            )}
            <Upload
              id="avatar-upload"
              name="avatar"
              showUploadList={false}
              customRequest={customUploadRequest}
              beforeUpload={beforeUpload}
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            >
              <button style={{ display: 'none' }} type="button">上传</button>
            </Upload>
          </div>
        </AvatarWrapper>
        
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfileUpdate}
        >
          <Form.Item
            name="username"
            label="用户名"
          >
            <Input disabled />
          </Form.Item>
          
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
            ]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>
          
          <Form.Item
            name="brand"
            label="所属品牌"
            rules={[{ required: true, message: '请选择所属品牌' }]}
          >
            <Select placeholder="请选择所属品牌">
              <Option value="EL">EL</Option>
              <Option value="CL">CL</Option>
              <Option value="MAC">MAC</Option>
              <Option value="DA">DA</Option>
              <Option value="LAB">LAB</Option>
              <Option value="OR">OR</Option>
              <Option value="Dr.jart+">Dr.jart+</Option>
              <Option value="IT">IT</Option>
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit"
              loading={loading}
            >
              保存修改
            </Button>
            <Button 
              style={{ marginLeft: 16 }}
              onClick={showPasswordModal}
            >
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </ProfileCard>
      
      {/* 修改密码模态框 */}
      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onOk={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={passwordForm}
          layout="vertical"
        >
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="请输入当前密码" 
            />
          </Form.Item>
          
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="请输入新密码" 
            />
          </Form.Item>
          
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="请确认新密码" 
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Profile; 