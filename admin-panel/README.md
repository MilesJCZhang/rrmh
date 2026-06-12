# 人人媒好管理后台

人人媒好相亲小程序的管理后台系统，供运营团队使用。

## 技术栈

- React 18
- TypeScript
- Ant Design 5
- React Router 6
- Axios

## 功能模块

1. **登录页面** (`/login`)
   - 管理员登录（用户名+密码）
   - 登录后保存 token 到 localStorage

2. **仪表盘** (`/`)
   - 数据概览
   - 展示总用户数、今日新增用户、总订单数、总收益等

3. **用户管理** (`/users`)
   - 用户列表（分页、搜索）
   - 用户详情
   - 禁用/启用用户

4. **推荐码管理** (`/referral-codes`)
   - 推荐码列表
   - 生成推荐码
   - 导出推荐码

5. **服务站管理** (`/stations`)
   - 服务站列表
   - 创建/编辑服务站
   - 启用/禁用服务站

6. **合伙人管理** (`/partners`)
   - 合伙人列表（可按状态筛选）
   - 合伙人详情
   - 审核合伙人
   - 查看收益记录

7. **提现管理** (`/withdrawals`)
   - 提现申请列表
   - 审核提现申请
   - 标记已打款

## 安装依赖

```bash
cd "/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/admin-panel"
npm install
```

## 启动项目

```bash
npm start
```

项目将在 `http://localhost:3000` 启动。

## 构建生产版本

```bash
npm run build
```

构建产物将输出到 `build/` 目录。

## 项目结构

```
admin-panel/
├── public/
│   └── index.html
├── src/
│   ├── components/          # 通用组件
│   │   ├── Layout.tsx      # 布局组件
│   │   ├── PrivateRoute.tsx # 路由守卫
│   │   └── PageHeader.tsx  # 页面标题组件
│   ├── pages/              # 页面
│   │   ├── Login/         # 登录页
│   │   ├── Dashboard/     # 仪表盘
│   │   ├── Users/         # 用户管理
│   │   ├── ReferralCodes/ # 推荐码管理
│   │   ├── Stations/      # 服务站管理
│   │   ├── Partners/      # 合伙人管理
│   │   └── Withdrawals/   # 提现管理
│   ├── services/           # API服务
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── referral-code.service.ts
│   │   ├── station.service.ts
│   │   ├── partner.service.ts
│   │   └── withdrawal.service.ts
│   ├── utils/              # 工具函数
│   │   ├── axios.config.ts
│   │   └── auth.util.ts
│   ├── App.tsx            # 路由配置
│   ├── index.tsx          # 入口
│   └── index.css          # 全局样式
├── package.json
├── tsconfig.json
└── README.md
```

## API 接口说明

管理后台需要与后端 API 服务配合使用。主要接口包括：

### 认证
- `POST /api/auth/login` - 管理员登录

### 仪表盘
- `GET /api/admin/dashboard/stats` - 获取统计数据

### 用户管理
- `GET /api/admin/users` - 获取用户列表
- `GET /api/admin/users/:id` - 获取用户详情
- `PUT /api/admin/users/:id/status` - 更新用户状态

### 推荐码管理
- `GET /api/admin/referral-codes` - 获取推荐码列表
- `POST /api/admin/referral-codes/generate` - 生成推荐码
- `GET /api/admin/referral-codes/export` - 导出推荐码

### 服务站管理
- `GET /api/stations` - 获取服务站列表
- `POST /api/stations` - 创建服务站
- `PUT /api/stations/:id` - 更新服务站
- `DELETE /api/stations/:id` - 删除服务站

### 合伙人管理
- `GET /api/partners` - 获取合伙人列表
- `GET /api/partners/:id` - 获取合伙人详情
- `PUT /api/partners/:id/approve` - 审核合伙人
- `GET /api/partners/:id/earnings` - 获取合伙人收益记录

### 提现管理
- `GET /api/admin/withdrawals` - 获取提现申请列表
- `PUT /api/admin/withdrawals/:id/approve` - 审核提现申请
- `PUT /api/admin/withdrawals/:id/mark-paid` - 标记已打款

## 注意事项

1. 确保后端 API 服务已启动并运行在 `http://localhost:3000`
2. 如需修改 API 地址，可在 `src/utils/axios.config.ts` 中修改 `baseURL`
3. 或直接设置环境变量 `REACT_APP_API_URL`

## 开发说明

- 所有页面都包含加载状态和错误处理
- 使用 Ant Design 组件库保证 UI 一致性
- 使用 TypeScript 保证类型安全
- 代码遵循 Google 编码规范

## 作者

人人媒好开发团队
