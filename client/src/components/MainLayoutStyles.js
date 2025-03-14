import styled from 'styled-components';
import { Layout } from 'antd';

const { Header } = Layout;

// 创建旋转动画组件
export const RotatingIcon = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-right: 12px;
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    border: 2px solid #1890ff;
    border-radius: 50%;
    animation: rotate 3s linear infinite;
  }

  &::before {
    width: 42px;
    height: 42px;
    border-color: #1890ff transparent #1890ff transparent;
  }

  &::after {
    width: 32px;
    height: 32px;
    border-color: transparent #52c41a transparent #52c41a;
    animation-direction: reverse;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .icon {
    color: #fff;
    z-index: 1;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }
`;

export const StyledHeader = styled(Header)`
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: linear-gradient(90deg, 
    rgba(24, 144, 255, 0.95) 0%,
    rgba(47, 84, 235, 0.9) 50%,
    rgba(114, 46, 209, 0.85) 100%
  );
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 1;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url('/header-bg.jpg') center/cover;
    opacity: 0.1;
    z-index: -1;
    pointer-events: none;
  }

  .logo-section {
    display: flex;
    align-items: center;
    font-size: 20px;
    font-weight: bold;
    color: #fff;
    margin-right: 48px;
  }

  .ant-menu {
    flex: 1;
    background: transparent;
    border-bottom: none;
    font-size: 16px;

    .ant-menu-item {
      color: rgba(255, 255, 255, 0.85);
      
      &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }
      
      &.ant-menu-item-selected {
        background: rgba(255, 255, 255, 0.15);
        
        &::after {
          border-bottom-color: #fff;
        }
      }
    }
  }

  .user-section {
    display: flex;
    align-items: center;
    gap: 24px;

    .notification-icon {
      font-size: 20px;
      color: #fff;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        transform: scale(1.1);
      }
    }

    .user-dropdown {
      cursor: pointer;
      color: #fff;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 8px;

      .ant-avatar {
        margin-right: 8px;
        transition: all 0.3s;

        &:hover {
          transform: scale(1.1);
        }
      }
    }
  }
`; 