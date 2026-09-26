# CLAUDE.md

本文件为 Claude Code 提供在本仓库中工作时的指导说明。

## 沟通方式
- 默认中文回复；代码、命令、变量名、文件路径保持英文
- 结论先行，简洁直接，不先铺垫背景
- 不谄媚，不夸"这是个很好的问题"，不以"当然可以"开头
- 给真实判断——方案有问题直接指出，发现更好做法主动说明

## Git
- 不自动 `git commit` 或 `git push`，除非我明确要求
- 提交前先展示将要提交的变更摘要
- commit message 使用简洁英文

## 红线操作
以下操作即使在 auto-accept 模式下也必须先问我：
- 删除文件、目录或 git 历史
- 修改 `.env`、密钥、token、证书、CI/CD 配置
- `git push`、`git rebase`、`git reset --hard`、强制推送
- 公开发布（`npm publish`、生产部署等）

---

## 项目概览

MoneyTracker 是一个个人记账 Web 应用，**纯前端实现，无后端**。用户可以记录收支、管理多账户与多币种、设置月度预算、查看统计图表。

**所有数据保存在浏览器 localStorage，不上传任何服务器。**

**技术栈：**
- 框架：Vue 3（Composition API + `<script setup>`）+ Vite + TypeScript
- 样式：Tailwind CSS v4（CSS-first 配置，无 tailwind.config.js）
- 状态管理：Pinia（仅一个 store）
- 本地存储：localStorage（单 key 存整库 JSON）
- 图表：ECharts 6 + vue-echarts（按需注册）
- 路由：Vue Router（**hash 模式**）
- 表单校验：手写 `src/lib/validate.ts`（不用 VeeValidate/Zod）
- 测试：Vitest

## 仓库结构

```
MoneyTracker/
├── src/
│   ├── components/
│   │   ├── ui/            # 基础组件（BaseButton、BaseInput、BaseModal 等）
│   │   └── charts/        # 图表组件
│   ├── views/             # 页面级组件（对应路由，薄壳）
│   ├── features/          # 按功能划分的业务模块
│   │   ├── transactions/  # 交易记录
│   │   ├── accounts/      # 账户与转账
│   │   ├── categories/    # 分类管理
│   │   ├── budgets/       # 预算管理
│   │   └── dashboard/     # 首页概览
│   ├── db/                # localStorage 读写、迁移、种子数据
│   ├── stores/            # Pinia 状态仓库
│   ├── composables/       # 组合式函数（useXxx）
│   ├── lib/               # 纯工具函数（金额、日期、统计、校验）
│   ├── types/             # 共享 TypeScript 类型
│   ├── router/            # 路由配置
│   └── App.vue
└── public/
```

## 常用命令

- `npm run dev` — 启动开发服务器，http://localhost:5173
- `npm run build` — 生产构建（含类型检查）
- `npm run preview` — 预览生产构建
- `npm run lint` — oxlint + eslint 检查并自动修复
- `npm run type-check` — TypeScript 类型检查（`vue-tsc --build`）
- `npx vitest run` — 运行全部单元测试（一次性）
- `npm run test:unit` — 同上，监听模式
- 装依赖时必须带镜像源：`npm install <pkg> --registry=https://registry.npmmirror.com`（官方源极慢，实测 6 分钟 vs 4 秒）

## 代码风格与约定

### 通用
- **必须**使用 TypeScript 严格模式；避免 `any`。
- **绝不**提交 `.env` 文件或任何密钥。
- 单个组件建议不超过 200 行，超出则拆分。
- 优先用 composables 复用逻辑，不用 mixins。

### 组件
- **必须**使用 `<script setup lang="ts">`，禁止 Options API。
- 组件文件 `PascalCase.vue`。
- 基础 UI 组件以 `Base` 开头，放 `components/ui/`。
- 业务组件放对应 `features/` 目录。
- Props 用 `defineProps<T>()`，事件用 `defineEmits<T>()`，禁止运行时对象写法。
- 样式**只用 Tailwind 工具类**；主题令牌见 `src/assets/main.css` 的 CSS 变量，通过 `bg-surface` / `text-ink` 这类工具类使用，**不要硬编码颜色值**。
- 模板中组件名用 `PascalCase`。

### 状态管理
- 全部业务数据在**唯一** store `src/stores/db.ts` 里，用一个 `reactive<Database>` +
  `watch(db, save, { deep: true })` 自动持久化。**不要新建第二个 store**。
- **绝不**在组件里直接读写 localStorage，一律走 store → `src/db/`。
- 局部 UI 状态用 `ref` / `reactive`，不要塞进 store。

### 数据与存储
- localStorage 单 key `moneytracker:db`，值为整个 `Database` JSON。
- 数据结构变更时**必须**同步三处：`src/types/index.ts`、`src/db/migrate.ts` 的
  `CURRENT_SCHEMA_VERSION` + 追加迁移函数、本文件的「核心数据模型」。
- **金额一律用整数分**（单位：分），**绝不**用浮点存金额。展示时才换算成元。
- 日期存 ISO 8601 字符串；记账日期精确到天（`'YYYY-MM-DD'`）。
- 账目不存币种，币种由所属账户推导。

### 表单与校验
- 校验逻辑写在 `src/lib/validate.ts`，纯函数，返回中文错误信息。
- 金额输入用 `parseAmountText` 解析，非法输入立即报错，不做静默兜底。

## 核心数据模型

完整定义见 `src/types/index.ts`，此处为摘要：

```ts
type TransactionType = 'income' | 'expense';
type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'JPY' | 'HKD' | 'GBP' | 'KRW' | 'AUD' | 'CAD' | 'SGD';

interface Account {
  id: string;
  name: string;
  currency: CurrencyCode;      // 账户绑定币种
  initialBalance: number;      // 初始余额（分）
  icon: string;                // emoji
  color: string;               // hex，仅界面标识，图表不用
  archived: boolean;           // 有账目时只归档不删除
  sortOrder: number;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;                // emoji
  color: string;               // 仅列表徽标，图表不用
  sortOrder: number;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: TransactionType;
  accountId: string;           // 币种由账户推导
  categoryId: string | null;   // 转账记录为 null
  amount: number;              // 恒为正整数（分），方向由 type 决定
  note?: string;
  occurredAt: string;          // 'YYYY-MM-DD'
  createdAt: string;
  transferId?: string;             // 转账成对记录共享的 id
  transferPeerAccountId?: string;
}

interface Budget {
  id: string;
  categoryId: string;
  month: string;               // 'YYYY-MM'
  limitAmount: number;         // 分（CNY）
  createdAt: string;
}

interface Settings {
  mainCurrency: CurrencyCode;                        // v1 固定 'CNY'
  exchangeRates: Partial<Record<CurrencyCode, number>>; // 1 外币 = X CNY，手工维护
  lastAccountId?: string;                            // 记一笔默认账户
}

interface Database {
  schemaVersion: number;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  settings: Settings;
}
```

## 路由结构

路由用 `createWebHashHistory`，组件懒加载。`meta.title` 写入 `document.title`，
`meta.tab` 控制底部 TabBar 高亮。

```
/                        首页概览：本月收支、预算提醒、最近交易
/transactions            账单列表（按月/类型/分类筛选）
/transactions/new        记一笔
/transactions/:id/edit   编辑
/transfers/new           转账
/stats                   统计图表
/budgets                 预算设置与进度
/accounts                账户管理
/categories              分类管理
/mine                    我的（入口列表）
/settings                设置（汇率维护、清空数据）
```

## 核心业务规则

- **统计与预算聚合一律排除转账记录**（`transferId` 存在即排除）；**账户余额包含转账**。
- 多币种折算一律走 `convertCents(cents, from, to, rates)`，非 CNY 币种之间经 CNY 中转。
  汇率缺失按 1:1 折算并在界面提示。主币种 v1 固定 CNY。
- 转账**原子生成两条记录**（转出 expense + 转入 income，共享 `transferId`，
  `categoryId` 为 null）；删除其一连带删除配对；转账记录编辑页只读。
- 预算阈值：`>= 100%` 超支，`>= 80%` 接近上限。状态色**必须**伴随图标 + 文字，
  绝不只靠颜色表达状态。
- 分类被账目引用时拒绝删除；账户只归档不删除。

## 可视化约定

写任何图表代码前先加载 `dataviz` skill 并遵循其规范。已落实到本项目的部分：

- 图表颜色取 `src/assets/main.css` 里的 `--series-1..8`（固定槽位顺序，按实体分配，
  **永不循环生成**）与 `--series-other`（折叠项）等令牌，**不要硬编码 hex**。
- 分类的用户自定义颜色只用于列表徽标，**图表一律用固定槽位色板**。
- **绝不用对偶轴**（两个 y 轴）。两个量纲不同的度量 → 两张图或归一化。
- 2 个以上系列必须有图例；堆叠段之间留 2px 表面间隙；柱顶 4px 圆角。
- 分类占比用**横向 100% 堆叠条**，不用饼图；top 7 + 「其他」共 8 段。
- 预算进度用 HTML/Tailwind 手写 meter，不用图表库；状态色取 `--status-*`，
  且这些状态色**永不当作系列色**。
- 数值列需要竖向对齐时才加 `.tnum`（tabular-nums）。

## 测试要求

- `src/lib/` 下的纯函数**必须**有单元测试。
- **测试文件放在被测目录下的 `__tests__/` 子目录**（`tsconfig.vitest.json` 只 include
  这个模式，放别处不会被类型检查）：
  `src/lib/money.ts` → `src/lib/__tests__/money.test.ts`。
- `src/db/migrate.ts` 的迁移与损坏兜底**必须**有测试。
- 纯展示组件不强制测试。
- 类型检查注意 `noUncheckedIndexedAccess: true`：数组下标和对象索引访问的类型是
  `T | undefined`，必须显式处理，不要用 `!` 硬断言。
- **每完成一个功能/阶段，测试后把结果追加记录到根目录 `TESTING.md`**，
  格式：日期、测试内容、操作步骤、结果。发现问题先修复再记录通过。

## Claude 工作流规则

- 写代码前先读相关已有文件，保持模式一致。
- 改完代码必须跑 `npm run lint`、`npm run type-check`；涉及 `lib/` 时加 `npx vitest run`。
- 金额计算前先确认单位是"分"还是"元"，避免混用。
- 涉及金额、日期、统计的逻辑优先写进 `src/lib/` 纯函数，便于测试。
- 新增依赖前先确认现有依赖能否满足；本项目刻意保持精简，UI 不用组件库。
- 优先编辑已有文件，而非新建文件，除非确实需要新模块。

## 禁止事项

- ❌ 不要用 Options API，统一 `<script setup>`。
- ❌ 任何地方都不要用浮点表示金额。
- ❌ 不要在组件里直接访问 localStorage，走 store → `src/db/`。
- ❌ 不要新建第二个 Pinia store，业务数据只放 `stores/db.ts`。
- ❌ 不要跳过迁移直接改数据结构。
- ❌ 不要在组件模板里硬编码颜色值，用设计令牌。
- ❌ 不要在 UI 组件里写业务逻辑，抽到 composables 或 store。
- ❌ 不要用对偶轴图表。
- ❌ 不要为了"以后可能用到"而加抽象层。

## 未来可能的扩展

（当前为纯前端版本，以下为预留方向，**暂不实现**）

- 数据导入/导出（JSON 或 CSV）
- 云同步与多设备支持
- 自然语言记账（规则引擎 → 后期可接入大模型）
- PWA 离线支持
