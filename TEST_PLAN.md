# 人人媒好小程序 - 测试计划文档

## 1. 测试概述

### 1.1 测试目标
对人人媒好小程序的后端API和React管理后台进行全面测试，确保系统功能完整、稳定、安全。

### 1.2 测试范围
- **后端API测试**：服务站管理、合伙人管理、提现管理、认证、用户、推荐码等API
- **React管理后台测试**：登录、仪表盘、用户管理、推荐码管理、服务站管理、合伙人管理、提现管理
- **集成测试**：端到端业务流程测试
- **性能测试**：API响应时间、数据库查询性能、前端加载性能

---

## 2. 测试策略

### 2.1 后端API测试策略
**测试工具**：Jest + Supertest + SQLite内存数据库

**测试方法**：
1. **单元测试**：针对每个API接口进行独立测试
2. **集成测试**：测试API之间的交互
3. **异常测试**：参数错误、权限不足、数据不存在等边界条件

**测试环境**：
- 使用SQLite内存数据库，避免污染生产数据
- 每个测试用例独立setup和teardown
- Mock外部依赖（如微信API）

### 2.2 React组件测试策略
**测试工具**：Jest + React Testing Library + jest-dom

**测试方法**：
1. **渲染测试**：组件是否正确渲染
2. **交互测试**：按钮点击、表单提交、用户操作
3. **路由测试**：路由守卫、页面跳转
4. **状态测试**：组件状态变化、数据展示

### 2.3 端到端测试策略
**测试工具**：Playwright

**测试场景**：
1. 用户登录 → 操作 → 退出
2. 完整的业务流程（如：创建服务站 → 申请合伙人 → 审核通过 → 提现申请 → 审核打款）

---

## 3. 测试用例清单

### 3.1 后端API测试用例

#### 3.1.1 服务站管理API（routes_stations.js）

| 用例ID | 接口 | 测试场景 | 预期结果 |
|--------|------|----------|----------|
| STATION-001 | POST /api/stations | 创建服务站（完整参数） | 201，创建成功 |
| STATION-002 | POST /api/stations | 创建服务站（缺少必填项） | 400，返回错误信息 |
| STATION-003 | POST /api/stations | 创建服务站（名称重复） | 400，名称已存在 |
| STATION-004 | GET /api/stations | 查询列表（默认分页） | 200，返回列表和分页信息 |
| STATION-005 | GET /api/stations | 查询列表（状态筛选） | 200，只返回指定状态的数据 |
| STATION-006 | GET /api/stations | 查询列表（关键词搜索） | 200，返回匹配的数据 |
| STATION-007 | GET /api/stations/:id | 查询详情（存在） | 200，返回详细信息 |
| STATION-008 | GET /api/stations/:id | 查询详情（不存在） | 404，返回错误信息 |
| STATION-009 | PUT /api/stations/:id | 更新服务站（完整参数） | 200，更新成功 |
| STATION-010 | PUT /api/stations/:id | 更新服务站（不存在） | 404，返回错误信息 |
| STATION-011 | PUT /api/stations/:id | 更新服务站（无更新字段） | 400，返回错误信息 |
| STATION-012 | DELETE /api/stations/:id | 删除服务站（存在） | 200，删除成功 |
| STATION-013 | DELETE /api/stations/:id | 删除服务站（不存在） | 404，返回错误信息 |
| STATION-014 | PUT /api/stations/:id/status | 更新状态（有效状态） | 200，状态更新成功 |
| STATION-015 | PUT /api/stations/:id/status | 更新状态（无效状态） | 400，返回错误信息 |

#### 3.1.2 合伙人管理API（routes_partners.js）

| 用例ID | 接口 | 测试场景 | 预期结果 |
|--------|------|----------|----------|
| PARTNER-001 | POST /api/partners/apply | 申请合伙人（完整参数） | 201，申请成功 |
| PARTNER-002 | POST /api/partners/apply | 申请合伙人（缺少必填项） | 400，返回错误信息 |
| PARTNER-003 | POST /api/partners/apply | 重复申请 | 400，已申请过 |
| PARTNER-004 | GET /api/partners/my/:user_id | 查询我的合伙人信息（存在） | 200，返回信息 |
| PARTNER-005 | GET /api/partners/my/:user_id | 查询我的合伙人信息（不存在） | 404，返回错误信息 |
| PARTNER-006 | GET /api/partners | 查询列表（管理员，默认分页） | 200，返回列表 |
| PARTNER-007 | GET /api/partners | 查询列表（状态筛选） | 200，只返回指定状态 |
| PARTNER-008 | GET /api/partners/:id | 查询详情（管理员） | 200，返回详细信息 |
| PARTNER-009 | PUT /api/partners/:id | 更新合伙人信息（有效数据） | 200，更新成功 |
| PARTNER-010 | PUT /api/partners/:id/approve | 审核合伙人（通过） | 200，审核通过 |
| PARTNER-011 | PUT /api/partners/:id/approve | 审核合伙人（拒绝，无原因） | 400，需要提供拒绝原因 |
| PARTNER-012 | GET /api/partners/:id/earnings | 查询收益（有数据） | 200，返回收益明细 |
| PARTNER-013 | GET /api/partners/:id/referrals | 查询推荐记录 | 200，返回推荐记录 |

#### 3.1.3 提现管理API（routes_withdrawals.js）

| 用例ID | 接口 | 测试场景 | 预期结果 |
|--------|------|----------|----------|
| WITHDRAW-001 | POST /api/withdrawals | 申请提现（完整参数） | 201，申请成功 |
| WITHDRAW-002 | POST /api/withdrawals | 申请提现（缺少必填项） | 400，返回错误信息 |
| WITHDRAW-003 | POST /api/withdrawals | 申请提现（金额≤0） | 400，金额必须大于0 |
| WITHDRAW-004 | GET /api/withdrawals/my | 查询我的提现记录 | 200，返回列表 |
| WITHDRAW-005 | GET /api/withdrawals/:id | 查询详情（存在且属于当前用户） | 200，返回详情 |
| WITHDRAW-006 | GET /api/withdrawals/:id | 查询详情（不属于当前用户） | 404，返回错误信息 |
| WITHDRAW-007 | PUT /api/withdrawals/:id/cancel | 取消申请（pending状态） | 200，取消成功 |
| WITHDRAW-008 | PUT /api/withdrawals/:id/cancel | 取消申请（非pending状态） | 400，不能取消 |
| WITHDRAW-009 | GET /api/withdrawals/admin/list | 查询列表（管理员） | 200，返回列表 |
| WITHDRAW-010 | PUT /api/withdrawals/admin/:id/approve | 审核（通过） | 200，审核通过 |
| WITHDRAW-011 | PUT /api/withdrawals/admin/:id/approve | 审核（拒绝，无原因） | 400，需要提供拒绝原因 |
| WITHDRAW-012 | PUT /api/withdrawals/admin/:id/mark-paid | 标记已打款 | 200，标记成功 |
| WITHDRAW-013 | GET /api/withdrawals/admin/stats | 获取统计（管理员） | 200，返回统计数据 |

#### 3.1.4 认证API（routes_auth.js）

| 用例ID | 接口 | 测试场景 | 预期结果 |
|--------|------|----------|----------|
| AUTH-001 | POST /auth/wechat-login | 微信登录（有code） | 200，返回token和用户信息 |
| AUTH-002 | POST /auth/wechat-login | 微信登录（无code） | 400，返回错误信息 |
| AUTH-003 | POST /auth/logout | 退出登录 | 200，退出成功 |
| AUTH-004 | GET /auth/userinfo | 获取用户信息（有token） | 200，返回用户信息 |
| AUTH-005 | GET /auth/userinfo | 获取用户信息（无token） | 401，未登录 |

#### 3.1.5 用户API（routes_user.js）

| 用例ID | 接口 | 测试场景 | 预期结果 |
|--------|------|----------|----------|
| USER-001 | GET /api/user/me | 获取当前用户信息（有token） | 200，返回用户信息 |
| USER-002 | GET /api/user/me | 获取当前用户信息（无token） | 401，未登录 |
| USER-003 | PUT /api/user/profile/update | 更新用户信息 | 200，更新成功 |

### 3.2 React管理后台测试用例

#### 3.2.1 登录页面（/login）

| 用例ID | 测试场景 | 预期结果 |
|--------|----------|----------|
| LOGIN-001 | 使用正确用户名密码登录 | 登录成功，跳转到仪表盘 |
| LOGIN-002 | 使用错误用户名登录 | 显示错误提示 |
| LOGIN-003 | 使用错误密码登录 | 显示错误提示 |
| LOGIN-004 | 检查Token保存 | Token正确保存到localStorage |
| LOGIN-005 | 登录后跳转 | 正确跳转到/dashboard |

#### 3.2.2 路由守卫

| 用例ID | 测试场景 | 预期结果 |
|--------|----------|----------|
| ROUTE-001 | 未登录访问/dashboard | 重定向到/login |
| ROUTE-002 | 已登录访问/login | 重定向到/dashboard |
| ROUTE-003 | 已登录访问受保护页面 | 正常显示页面 |

#### 3.2.3 仪表盘（/）

| 用例ID | 测试场景 | 预期结果 |
|--------|----------|----------|
| DASH-001 | 页面渲染 | 正确显示统计数据 |
| DASH-002 | 刷新功能 | 点击刷新按钮，数据重新加载 |

#### 3.2.4 用户管理（/users）

| 用例ID | 测试场景 | 预期结果 |
|--------|----------|----------|
| USER-001 | 用户列表展示 | 正确显示用户列表 |
| USER-002 | 分页功能 | 分页控件正常工作 |
| USER-003 | 搜索功能 | 输入关键词，显示匹配结果 |
| USER-004 | 禁用/启用用户 | 点击按钮，状态正确更新 |

#### 3.2.5 推荐码管理（/referral-codes）

| 用例ID | 测试场景 | 预期结果 |
|--------|----------|----------|
| REFCODE-001 | 推荐码列表展示 | 正确显示推荐码列表 |
| REFCODE-002 | 生成推荐码 | 点击生成按钮，成功生成 |
| REFCODE-003 | 导出推荐码 | 点击导出按钮，下载文件 |

#### 3.2.6 服务站管理（/stations）

| 用例ID | 测试场景 | 预期结果 |
|--------|----------|----------|
| STATION-UI-001 | 服务站列表展示 | 正确显示服务站列表 |
| STATION-UI-002 | 创建服务站 | 填写表单，点击提交，创建成功 |
| STATION-UI-003 | 编辑服务站 | 点击编辑按钮，修改信息，保存成功 |
| STATION-UI-004 | 删除服务站 | 点击删除按钮，确认后删除成功 |
| STATION-UI-005 | 状态切换 | 点击状态开关，状态正确更新 |

#### 3.2.7 合伙人管理（/partners）

| 用例ID | 测试场景 | 预期结果 |
|--------|----------|----------|
| PARTNER-UI-001 | 合伙人列表展示（按状态筛选） | 正确显示合伙人列表 |
| PARTNER-UI-002 | 合伙人详情查看 | 点击查看按钮，显示详情 |
| PARTNER-UI-003 | 审核合伙人 | 点击审核按钮，审核成功 |

#### 3.2.8 提现管理（/withdrawals）

| 用例ID | 测试场景 | 预期结果 |
|--------|----------|----------|
| WITHDRAW-UI-001 | 提现列表展示（按状态筛选） | 正确显示提现列表 |
| WITHDRAW-UI-002 | 审核提现申请 | 点击审核按钮，审核成功 |
| WITHDRAW-UI-003 | 标记已打款 | 点击打款按钮，标记成功 |

---

## 4. 测试环境要求

### 4.1 后端API测试环境
- **Node.js**: v16+
- **数据库**: SQLite（内存模式）
- **测试框架**: Jest + Supertest
- **依赖包**:
  ```json
  {
    "devDependencies": {
      "jest": "^29.7.0",
      "supertest": "^6.3.4",
      "better-sqlite3": "^9.4.3"
    }
  }
  ```

### 4.2 React组件测试环境
- **Node.js**: v16+
- **测试框架**: Jest + React Testing Library
- **依赖包**:
  ```json
  {
    "devDependencies": {
      "@testing-library/react": "^14.2.1",
      "@testing-library/jest-dom": "^6.4.2",
      "@testing-library/user-event": "^14.5.2",
      "jest": "^29.7.0",
      "ts-jest": "^29.1.2"
    }
  }
  ```

### 4.3 端到端测试环境
- **浏览器**: Chromium（Playwright自带）
- **测试工具**: Playwright
- **依赖包**:
  ```json
  {
    "devDependencies": {
      "@playwright/test": "^1.42.1"
    }
  }
  ```

---

## 5. 测试执行计划

### 5.1 第一阶段：后端API测试（第1-2天）
1. 搭建测试环境
2. 编写测试用例
3. 执行测试
4. 修复发现的问题
5. 回归测试

### 5.2 第二阶段：React组件测试（第3-4天）
1. 搭建测试环境
2. 编写测试用例
3. 执行测试
4. 修复发现的问题
5. 回归测试

### 5.3 第三阶段：集成测试（第5天）
1. 启动后端服务和前端应用
2. 执行端到端测试
3. 记录测试结果

### 5.4 第四阶段：性能测试（第6天）
1. API响应时间测试
2. 数据库查询性能测试
3. 前端页面加载性能测试

### 5.5 第五阶段：测试报告（第7天）
1. 整理测试结果
2. 编写测试报告
3. 提交Bug报告

---

## 6. 风险评估

### 6.1 技术风险
- **风险1**: 数据库表结构不完整，导致测试失败
  - **应对措施**: 先检查数据库表结构，必要时先运行数据库迁移脚本
  
- **风险2**: 认证中间件未实现，影响需要权限的API测试
  - **应对措施**: Mock认证中间件，或临时跳过权限检查

### 6.2 进度风险
- **风险**: 测试用例较多，时间可能不足
  - **应对措施**: 优先测试核心功能，非核心功能可适当简化

---

## 7. 交付物

### 7.1 测试文档
- `TEST_PLAN.md` - 测试计划文档（本文档）
- `TEST_REPORT.md` - 测试报告
- `BUG_REPORT.md` - Bug报告

### 7.2 测试脚本
- `tests/api/*.test.js` - 后端API测试
- `admin-panel/src/**/*.test.tsx` - React组件测试
- `tests/e2e/*.spec.js` - 端到端测试

### 7.3 测试数据
- 测试数据库初始化脚本
- Mock数据文件

---

## 8. 测试标准

### 8.1 通过标准
- 所有P0（核心功能）测试用例通过
- P1（重要功能）测试用例通过率 ≥ 90%
- P2（辅助功能）测试用例通过率 ≥ 80%
- 无Critical或Major级别的Bug

### 8.2 失败处理
- Critical Bug：立即通知开发团队修复
- Major Bug：24小时内修复
- Minor Bug：可延后修复或记录在案

---

## 9. 附录

### 9.1 测试优先级定义
- **P0（核心功能）**: 用户登录、服务站管理、合伙人审核、提现审核
- **P1（重要功能）**: 查询列表、分页、搜索、状态更新
- **P2（辅助功能）**: 边界条件、异常处理

### 9.2 Bug严重等级定义
- **Critical**: 系统崩溃、数据丢失、安全漏洞
- **Major**: 核心功能无法使用、数据错误
- **Minor**: UI问题、提示信息不准确、边缘场景

---

**文档版本**: v1.0  
**创建日期**: 2025-05-15  
**创建人**: Edward（QA工程师）  
**审核人**: 待定
