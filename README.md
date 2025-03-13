# 项目管理系统 (Project Management System)

这是一个功能完整的项目管理系统，采用前后端分离的架构设计，适合团队协作和项目跟踪。

## 技术栈

### 前端 (client)
- React.js (React 18)
- React Router v6 (路由管理)
- Ant Design (UI组件库)
- Ant Design Charts (图表组件)
- Axios (HTTP请求)
- Styled Components (CSS-in-JS)
- JWT认证 (jwt-decode)

### 后端 (server)
- Node.js
- Express.js (Web框架)
- Sequelize (ORM，对象关系映射)
- Multer (文件上传处理)
- 使用了环境变量配置(.env)

## 项目结构

### 前端结构 (client)
- **src/components**: 包含可复用的UI组件，如MainLayout（主布局）
- **src/pages**: 包含所有页面组件，如Dashboard、Login、Register、ProjectList等
- **src/contexts**: 包含React上下文，如AuthContext（认证上下文）
- **src/api**: 包含API调用相关的工具
- **src/utils**: 包含各种工具函数

### 后端结构 (server)
- **routes**: 定义API路由，包括auth、projects、workItems、users、tickets、dashboard等
- **models**: 定义数据库模型，包括User、Project、WorkItem、Ticket等
- **controllers**: 包含业务逻辑处理
- **middleware**: 包含中间件，如认证中间件
- **config**: 包含配置文件，如数据库配置
- **public/uploads**: 用于存储上传的文件，包括图片、文档和头像

## 主要功能

1. **用户认证**：
   - 登录/注册
   - JWT认证
   - 用户权限管理

2. **项目管理**：
   - 项目创建、查看、编辑和删除
   - 项目详情页面
   - 项目成员管理

3. **工作项管理**：
   - 工作项创建、查看、编辑和删除
   - 工作项详情页面
   - 工作项状态跟踪

4. **票据管理**：
   - 票据创建、查看、编辑和删除
   - 票据详情页面

5. **仪表盘**：
   - 数据可视化
   - 项目和工作项统计
   - 用户活动跟踪

6. **文件上传**：
   - 支持图片、文档和头像上传
   - 文件存储和访问

7. **用户资料**：
   - 用户资料查看和编辑
   - 头像上传

## 数据模型

主要的数据模型包括：
- **User**: 用户信息
- **Project**: 项目信息
- **WorkItem**: 工作项信息
- **Ticket**: 票据信息
- **WorkItemActivity**: 工作项活动记录

## 路由结构

### 前端路由
- `/login`: 登录页面
- `/register`: 注册页面
- `/`: 主页/仪表盘
- `/projects`: 项目列表
- `/projects/:id`: 项目详情
- `/work-items/:id`: 工作项详情
- `/profile`: 用户资料

### 后端API路由
- `/api/auth`: 认证相关API
- `/api/users`: 用户相关API
- `/api/projects`: 项目相关API
- `/api/work-items`: 工作项相关API
- `/api/tickets`: 票据相关API
- `/api/dashboard`: 仪表盘相关API

## 启动方式

1. **前端**:
   ```
   cd client
   npm install
   npm start
   ```

2. **后端**:
   ```
   cd server
   npm install
   npm start
   ```

## 环境要求
- Node.js 14.x 或更高版本
- npm 6.x 或更高版本
- 现代浏览器（Chrome、Firefox、Safari、Edge等）

## 开发环境设置

1. 克隆仓库:
   ```
   git clone https://github.com/kmwang777889/web_project.git
   cd web_project
   ```

2. 安装依赖:
   ```
   # 安装根目录依赖
   npm install
   
   # 安装前端依赖
   cd client
   npm install
   
   # 安装后端依赖
   cd ../server
   npm install
   ```

3. 配置环境变量:
   - 在server目录下创建.env文件，参考.env.example

4. 启动开发服务器:
   ```
   # 启动后端服务器
   cd server
   npm start
   
   # 在另一个终端启动前端服务器
   cd client
   npm start
   ```

## 贡献指南
欢迎贡献代码、报告问题或提出新功能建议。请遵循以下步骤：
1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证
[MIT](LICENSE) 