---
name: admin-panel-functionality-audit
overview: 系统性分析管理后台16个功能模块的完善度、数据打通状态、前后端接口对齐情况，识别缺失功能和数据断层，输出优化优先级排序和分步实施计划。
todos:
  - id: audit-phase-zero
    content: P0审计：逐模块快速评估API端点存在性——读取管理后台每个service文件，对照server.js和路由文件，判断每个API调用是否有后端实现。产出16模块的API存在性清单，标注缺失端点
    status: pending
  - id: audit-phase-one
    content: P1审计：数据字段对齐——读取管理后台页面组件的数据绑定，对照后端路由响应的字段名，检查camelCase/snake_case不匹配、字段缺失。同时检查小程序services/api.js中定义的端点是否与管理后台一致
    status: pending
    dependencies:
      - audit-phase-zero
  - id: audit-phase-two
    content: P2审计：CRUD操作覆盖——检查每个管理后台模块是否只有展示功能而缺少实际操作（审核按钮、编辑表单、删除确认）。对照小程序业务流确认管理后台操作能否反向影响小程序数据
    status: pending
    dependencies:
      - audit-phase-one
  - id: audit-phase-three
    content: P3审计：未注册路由模块分析——检查Finance子目录4个页面、Reports、Verifications的实际代码，判断是否值得启用，与现有后端路由的对应关系
    status: pending
    dependencies:
      - audit-phase-two
  - id: fix-p0-blocking
    content: 修复P0阻断性问题：缺失的API端点实现（如recommend相关操作端点、verification审核端点等），沙龙报名路径不匹配（/join vs /signup）
    status: pending
    dependencies:
      - audit-phase-zero
  - id: fix-p1-high
    content: 修复P1高优先级：API路径统一（将 /api/admin/ 和 /v1/ 前缀逐步对齐到统一规范），routes_partners.js加载失败修复，字段名映射补全
    status: pending
    dependencies:
      - audit-phase-one
      - fix-p0-blocking
  - id: fix-p2-medium
    content: 修复P2中优先级：为缺少操作的页面补充审核/编辑/删除功能（如Withdrawals审核通过按钮、Partners审核拒绝原因输入），档案管理数据字段补全
    status: pending
    dependencies:
      - audit-phase-two
      - fix-p1-high
  - id: fix-p3-low
    content: 修复P3低优先级：启用未注册路由的页面（如Reports数据报表、Verifications认证审核统计），财务模块路径规范化
    status: pending
    dependencies:
      - audit-phase-three
      - fix-p2-medium
  - id: final-verification
    content: 最终验证：重启服务后逐模块端到端测试，确认管理后台每个页面的CRUD操作正常、数据与小程序一致
    status: pending
    dependencies:
      - fix-p3-low
---

## 管理后台全面审计与优化

### 背景

已完成多套后端管理后台整合，统一到 A1（React+CRA+AntDesign5）作为唯一生产管理后台。现在需要对管理后台的每个功能模块进行系统性审计，检查：API 对接是否完整、数据字段是否对齐、CRUD 操作是否覆盖、与小程序数据链路是否双向打通。

### 审计范围

管理后台已注册的 16 个页面模块 + 未注册的 4 个候选模块，对照后端路由实现和小程序数据流。

### 核心目标

1. 逐模块产出 API 对接完整性审计报告（每模块一张检查表）
2. 按 P0（阻断）/ P1（高）/ P2（中）/ P3（低）四级定级
3. 按优先级逐步修复，每完成一级验证后再进入下一级

## 技术栈

- 管理后台：React 18 + TypeScript + Ant Design 5 + Axios + Recharts
- 后端 S2（本地）：Express.js + better-sqlite3，端口 3000，SQLite `renrenmei.db`
- 后端 S1（生产）：Express.js + Prisma + MySQL，端口 3001，部署在 ubuntu@175.24.227.251
- 小程序：微信原生框架，已切换生产模式（API 指向 https://rrmhdate.cn）

## 分析方法

1. 读取管理后台每个 service 文件，提取 API 调用（URL/方法/参数）
2. 对照 `server.js` 和路由文件，确认后端是否有对应实现
3. 读取管理后台页面组件，确认数据字段使用
4. 对照小程序对应页面和 `services/api.js`，确认数据链路打通
5. 列出缺失、不匹配、功能不完整项

## API 前缀现状（关键发现）

管理后台服务文件使用三种 API 前缀，需要统一审计：

- `/v1/admin/`：commission、config、score、premium、fund-custody 等 service
- `/api/admin/`：partner、referral-code、station、withdrawal、order、finance、verification 等 service（生产环境经 Nginx rewrite → `/api/admin/*` → proxy 3001）
- `/v1/`（无 admin 前缀）：activity.service 调 `/v1/salon/:id/approve`，user.service 调 `/v1/admin/users`

## 使用的扩展

### SubAgent

- **code-explorer**
- 用途：深度探索管理后台每个 service 文件和页面组件，提取 API 调用清单、数据字段依赖、CRUD 操作覆盖
- 预期结果：产出 16+ 模块的 API 调用清单和字段映射表，用于问题定级

### Skill

- **miniprogram-development**
- 用途：验证小程序端对应页面的数据字段是否与管理后台一致，确保数据链路双向打通
- 预期结果：小程序的 services/api.js 定义与管理后台调用的 API 路径对齐确认