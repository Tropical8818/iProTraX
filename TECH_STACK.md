# iProTraX 技术栈 / Technology Stack

> **iProTraX v8.2.1** — AI 驱动的生产追踪系统 / AI-Powered Production Tracker

---

## 1. 核心框架与运行时 / Core Framework & Runtime

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | ^16.1.6 | 全栈 React 框架（含 API 路由）|
| **React** | 19.2.3 | UI 组件库 |
| **React DOM** | 19.2.3 | DOM 渲染引擎 |
| **Node.js** | 22 (Alpine) | 运行时环境 |
| **TypeScript** | ^5 | 类型安全的 JavaScript 超集 |

---

## 2. 数据库与 ORM / Database & ORM

| 技术 | 版本 | 用途 |
|------|------|------|
| **PostgreSQL** | 15-alpine | 主关系型数据库 |
| **Prisma** | 6.19.1 | ORM（对象关系映射）|
| **@prisma/client** | 6.19.1 | Prisma 查询客户端 |

### 数据库模型 / Database Models
`User` · `Product` · `Order` · `OperationLog` · `Comment` · `SavedReport` · `StepProgress` · `ApiKey`

---

## 3. 缓存与实时通信 / Caching & Real-time

| 技术 | 版本 | 用途 |
|------|------|------|
| **Redis** | alpine | 内存缓存 & 发布/订阅代理 |
| **IORedis** | ^5.9.2 | Redis 客户端库 |
| **Server-Sent Events (SSE)** | 原生 | 实时推送（EventSource API）|

---

## 4. 认证与安全 / Authentication & Security

| 技术 | 版本 | 用途 |
|------|------|------|
| **jose** | ^6.1.3 | JWT 加密/解密 |
| **bcryptjs** | ^3.0.3 | 密码哈希 |
| **Node Crypto** | 原生 | PBKDF2 API 密钥哈希、TLS/SSL |

### 认证方式 / Authentication Methods
- Session 认证（httpOnly Cookie）
- API Key 认证（SHA-256 / PBKDF2 哈希）
- JWT Token 会话加密
- 基于角色的访问控制（`user` / `supervisor` / `admin` / `kiosk`）

---

## 5. AI / LLM 集成 / AI Providers

| 供应商 | 用途 | 环境变量 |
|--------|------|----------|
| **OpenAI** | 主要 AI / GPT 集成 | `OPENAI_API_KEY` |
| **DeepSeek** | 国内备选方案 | `DEEPSEEK_API_KEY` |
| **Ollama** | 本地 LLM 选项 | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

### AI 相关库
- **openai** `^6.16.0` — OpenAI SDK
- 自定义多供应商抽象层（`src/lib/ai/`）

---

## 6. UI 组件与样式 / UI Components & Styling

| 技术 | 版本 | 用途 |
|------|------|------|
| **Tailwind CSS** | ^4 | 实用优先 CSS 框架 |
| **@tailwindcss/postcss** | ^4 | PostCSS Tailwind 插件 |
| **PostCSS** | — | CSS 转换处理 |
| **Lucide React** | ^0.562.0 | 图标库 |
| **Recharts** | ^3.6.0 | React 图表库（柱状图、折线图、饼图）|

---

## 7. 拖拽排序 / Drag-and-Drop

| 技术 | 版本 | 用途 |
|------|------|------|
| **@dnd-kit/core** | ^6.3.1 | 拖拽引擎 |
| **@dnd-kit/sortable** | ^10.0.0 | 可排序列表/网格 |
| **@dnd-kit/utilities** | ^3.2.2 | 辅助工具 |

---

## 8. 数据导入/导出 / Data Import & Export

| 技术 | 版本 | 用途 |
|------|------|------|
| **exceljs** | ^4.4.0 | Excel 文件读写（.xlsx）|

---

## 9. 国际化 / Internationalization (i18n)

| 技术 | 版本 | 用途 |
|------|------|------|
| **next-intl** | ^4.8.1 | 多语言支持 |

**支持语言**：English (`en`) · 简体中文 (`zh`)

---

## 10. 二维码与条码 / QR Code & Barcode

| 技术 | 版本 | 用途 |
|------|------|------|
| **html5-qrcode** | ^2.3.8 | QR/条码扫描（移动端友好）|

---

## 11. 日期与时间工具 / Date & Time Utilities

| 技术 | 版本 | 用途 |
|------|------|------|
| **date-fns** | ^4.1.0 | 日期操作与格式化 |

---

## 12. 原生/WASM 模块 / Native & WASM Modules

### Rust / WebAssembly 许可证验证器（`native/license-verifier/`）

| Crate | 版本 | 用途 |
|-------|------|------|
| **wasm-bindgen** | 0.2 | WASM ↔ JS 绑定 |
| **serde** | 1.0 | 序列化框架 |
| **serde_json** | 1.0 | JSON 序列化 |
| **p256** | 0.13 | 椭圆曲线密码学（ECDSA）|
| **base64** | 0.21 | Base64 编码 |
| **hex** | 0.4 | 十六进制编码 |
| **chrono** | 0.4 | 日期/时间处理 |
| **getrandom** | 0.2 | 随机数生成 |

---

## 13. 测试框架 / Testing

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vitest** | ^3.2.4 | 单元测试（Vite 驱动）|
| **@testing-library/react** | ^16.3.1 | React 组件测试 |
| **@testing-library/dom** | ^10.4.1 | DOM 测试工具 |
| **jsdom** | ^27.0.1 | Node.js DOM 模拟 |
| **@playwright/test** | ^1.57.0 | E2E 浏览器测试 |

---

## 14. 构建与打包工具 / Build & Bundling

| 技术 | 版本 | 用途 |
|------|------|------|
| **Webpack** | 内置于 Next.js | 模块打包 |
| **webpack-obfuscator** | ^3.6.0 | 生产环境 JS 混淆 |
| **javascript-obfuscator** | ^5.1.0 | 代码混淆库 |
| **tsx** | ^4.19.2 | TypeScript 执行器（脚本用）|

---

## 15. 代码质量 / Code Quality

| 技术 | 版本 | 用途 |
|------|------|------|
| **ESLint** | ^9 | JS/TS 代码检查 |
| **eslint-config-next** | 16.1.1 | Next.js ESLint 配置 |
| **lint-staged** | ^16.2.7 | 对暂存文件运行 Lint |
| **Husky** | ^9.1.7 | Git 钩子管理器 |
| **@vitejs/plugin-react** | ^5.1.2 | Vitest React 插件 |

---

## 16. 容器化与编排 / Containerization & Orchestration

| 技术 | 版本 | 用途 |
|------|------|------|
| **Docker** | Latest | 容器运行时 |
| **Docker Compose** | v1 | 多容器编排 |
| **Alpine Linux** | Latest | 轻量级基础镜像（node:22-alpine）|

### Docker 多阶段构建策略
1. **dependencies** 阶段 — 安装 npm 依赖
2. **builder** 阶段 — 编译 Next.js + Prisma
3. **runner** 阶段 — 优化后的生产镜像

### Docker Compose 服务
| 服务 | 镜像 | 端口 |
|------|------|------|
| **app** | `hzhang9/iprotrax:latest` | 3001 |
| **db** | `postgres:15-alpine` | 5432 |
| **redis** | `redis:alpine` | 6379 |

---

## 17. CI/CD 流水线 / CI/CD Pipelines

### CI 流水线（GitHub Actions）
- **触发**：push 到 `main` / `enterprise-upgrade`，PR 到 `main`
- **步骤**：Checkout → Install → Lint → Build

### CD 流水线（GitHub Actions）
- **触发**：push 到 `main`
- **步骤**：QEMU → Docker Buildx → Docker Hub 登录 → Build & Push

---

## 18. 配置文件一览 / Configuration Files

| 文件 | 用途 |
|------|------|
| `tsconfig.json` | TypeScript 编译配置（ES2017 目标，strict 模式）|
| `next.config.ts` | Next.js 配置（WASM、安全响应头、CSP）|
| `postcss.config.mjs` | PostCSS + Tailwind 插件 |
| `vitest.config.ts` | Vitest 配置（jsdom 环境）|
| `playwright.config.ts` | Playwright E2E 测试配置 |
| `eslint.config.mjs` | ESLint 规则（Core Web Vitals、TypeScript）|
| `.env.example` | 环境变量模板 |
| `docker-compose.yml` | 容器编排配置 |
| `Dockerfile` | 多阶段 Docker 构建文件 |

---

## 19. 环境变量 / Environment Variables

### 必填 / Required
| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `SESSION_SECRET` | 会话加密密钥（至少 32 字符）|
| `API_KEY_PEPPER` | API 密钥哈希的随机盐 |

### 可选 / Optional
| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_PROVIDER` | `openai` | AI 供应商选择（openai / ollama / deepseek）|
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | 本地 Ollama 地址 |
| `OLLAMA_MODEL` | `llama3.1` | 本地模型名称 |
| `DEEPSEEK_API_KEY` | — | DeepSeek API 密钥 |
| `ADMIN_PASSWORD` | — | 超级管理员初始密码 |
| `LICENSE_KEY` | — | 商业许可证（空 = 免费版：1 条线, 10 用户）|
| `TZ` | `Asia/Singapore` | 时区 |
| `NODE_ENV` | — | 环境模式（production / development）|

---

## 20. NPM 脚本 / NPM Scripts

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动 Next.js 开发服务器 |
| `npm run build` | 生产环境构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint |
| `npm test` | 运行 Vitest 单元测试 |
| `npm run docker:up` | 构建并启动 Docker 容器 |
| `npm run docker:push` | 推送镜像到 Docker Hub |

---

## 统计摘要 / Summary Statistics

| 指标 | 数值 |
|------|------|
| 生产依赖 | 20+ |
| 开发依赖 | 19 |
| Prisma 迁移 | 5 |
| 测试文件 | 3 |
| API 路由 | 40+ |
| 数据库模型 | 9 |
| AI 供应商 | 3 |
| 支持语言 | 2（EN、ZH）|
| Docker 服务 | 3 |
