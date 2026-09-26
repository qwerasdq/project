# 测试记录

每完成一个功能/阶段，测试后在此追加记录。格式：日期 / 测试内容 / 操作步骤 / 结果。

---

## 2026-09-27 — 阶段 0：项目脚手架与构建链路

**测试内容**：脚手架可运行、依赖安装、Tailwind 令牌生效、类型检查与 lint 通过、生产构建可用。

**操作步骤**

1. 用 create-vue 3.24.0 生成项目骨架（TS + Router + Pinia + Vitest + ESLint + Prettier）。
2. `npm install` 安装基础依赖 → 走镜像源 `registry.npmmirror.com` 安装 `tailwindcss`、`@tailwindcss/vite`、`echarts`、`vue-echarts`。
3. 删除 create-vue 模板演示文件（HelloWorld / TheWelcome / WelcomeItem / 5 个图标 / AboutView / HomeView / counter.ts / logo.svg / base.css）。
4. 接入 Tailwind v4 的 Vite 插件，在 `src/assets/main.css` 写入明暗两套设计令牌。
5. 改写 `index.html`（中文 lang、标题）、`src/App.vue`、`src/router/index.ts`。
6. 执行 `npm run type-check`。
7. 执行 `npm run lint`。
8. 执行 `npm run build`，并检查产物 CSS。
9. 启动 `npm run dev`，用 curl 检查 HTTP 响应与 HTML 内容。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npm run type-check` | 通过，无错误 |
| `npm run lint` | 通过，无错误 |
| `npm run build` | 成功，27 个模块，161ms |
| Tailwind 令牌生成 | `.bg-page{background-color:var(--page)}`、`.text-ink{color:var(--ink)}` 已生成，说明 `@theme inline` 生效、暗色变量可正确跟随系统切换 |
| 暗色媒体查询 | 产物 CSS 中存在 `prefers-color-scheme` 块 |
| dev server | HTTP 200，`<html lang="zh-CN">`、`<title>记账本</title>` 正确 |

**产物体积**：CSS 6.57 kB（gzip 2.32 kB），JS 88.38 kB（gzip 34.39 kB）。

**备注**：`npm run test:unit` 走的是 vitest 监听模式，一次性运行请用 `npx vitest run`。本阶段尚无测试文件，阶段 1 起补充。

---

## 2026-09-27 — 阶段 1：类型定义与纯函数层

**测试内容**：金额换算、日期处理、统计聚合、表单校验、图表槽位分配，共 6 个模块 163 条单元测试。

**操作步骤**

1. 编写 `src/types/index.ts` 定义全部实体类型。
2. 编写 `src/lib/` 下 6 个模块：`id.ts`、`money.ts`、`date.ts`、`validate.ts`、`stats.ts`、`viz.ts`。
3. 在 `src/lib/__tests__/` 下编写对应测试（tsconfig.vitest.json 只 include 该模式）。
4. `npx vitest run` → 发现 1 条失败。
5. 修复后重跑，再跑 `npm run type-check` 与 `npm run lint`。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npx vitest run` | 6 个文件 163 条测试全部通过，耗时 647ms |
| `npm run type-check` | 通过（注意 `noUncheckedIndexedAccess: true` 已全程遵守） |
| `npm run lint` | 通过 |

**过程中发现并修复的问题**

1. **`assignSeriesSlots` 槽位不稳定**（测试捕获）
   - 现象：断言「十月 b 掉出榜单后，c 的槽位不变」失败，c 从槽位 2 变成 1。
   - 原因：原实现按「取第一个空槽」贪心分配，中间实体消失会让后面的实体整体前移，导致换个月份图表整片换色。
   - 修复：改为「槽位 = 分类在稳定顺序中的序号 mod 8」，仅当两个分类撞到同一槽位时才顺延。既保证颜色跟随实体，又不产生同图同色。

2. **`if (!r.ok) expect(...)` 触发 `no-conditional-expect`**（lint 捕获）
   - 修复：改用 `expect(fn(x)).toEqual({ ok: false, error: '...' })` 整体断言。

**关键约定（已写入 CLAUDE.md）**

- 金额一律整数分；**所有币种统一存主单位百分之一**，日元/韩元展示时由 Intl 自动取整。
- 汇率缺失按 1:1 兜底，并由 `missingRates` 单独提示，不静默。
- 统计聚合一律排除转账；`accountBalance` 包含转账 —— 两者语义不同，测试中各有一条用例专门锁定该行为。

---

## 2026-09-27 — 阶段 2：数据层与 Pinia store

**测试内容**：localStorage 读写与损坏兜底、版本迁移、种子数据、store 全部业务动作（账户 / 分类 / 记账 / 转账 / 预算 / 汇率 / 重置）。

**操作步骤**

1. 编写 `src/db/migrate.ts`（版本迁移与结构校验）、`src/db/seed.ts`（种子数据）、`src/db/index.ts`（读写与兜底）。
2. 编写 `src/stores/db.ts`：单 store，`reactive<Database>` + `watch(deep)` 自动落盘。
3. 编写 `src/db/__tests__/migrate.test.ts`、`src/stores/__tests__/db.test.ts`。
4. `npx vitest run` → 16 条失败。
5. 定位根因并修复（见下）。
6. `npm run lint` → 又发现 8 处 lint 错误，修复后重跑。
7. 全量重跑测试、类型检查、构建。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npx vitest run` | 8 个文件 235 条测试全部通过 |
| `npm run type-check` | 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 成功，90ms |

**过程中发现并修复的问题**

1. **`safeGet` 兜底顺序写反 —— 真实 bug，非测试问题**（16 条失败共同根因）
   - 现象：新建 store 时读到了上一次会话的陈旧数据；localStorage 清空后仍能读出旧值。
   - 原因：原实现是 `localStorage.getItem(key) ?? memoryFallback.get(key) ?? null`。
     localStorage 返回 `null`（**真的没有数据**）与 localStorage **不可用**这两种情况被混为一谈，
     前者会错误地回退到模块级内存副本，读到已删除的内容。
   - 修复：localStorage 可用时它是唯一权威来源，`null` 就是 `null`；只有抛异常（隐私模式、
     存储被禁用）才回退内存副本。
   - 影响：这个 bug 会让「清空数据」在部分环境下失效并复活旧数据，属于用户可见的数据正确性问题。

2. **测试间状态泄漏**（修复 bug 1 后仅剩 1 条）
   - 原因：store 的 `watch` 是异步落盘（`flush: 'pre'`），上个用例挂起的写入会在下个用例
     `localStorage.clear()` 之后才落地，污染下一个用例。
   - 修复：用例之间显式 `$dispose()` 旧 store 并 `await nextTick()`；`reopen()` 辅助函数
     则先等写入落地再销毁（销毁会取消未执行的 watcher）。

3. **`no-conditional-expect` lint 规则**（8 处）
   - `if (result.ok) expect(...)` 形式被禁。改用会 `throw` 的 `expectOk()` 辅助函数，
     失败信息反而更清晰。

**关键约定（已写入 CLAUDE.md）**

- store 是唯一数据入口；组件绝不直接碰 localStorage。
- 转账不可编辑（`updateTransaction` 对转账记录是空操作），删除时按 `transferId` 连带删除配对。
- 分类被账目或预算引用时拒绝删除，返回中文错误信息。
- 预算提醒只在**跨线**时触发（未超→越过 80%、未超→越过 100%），已在超支状态继续记账不重复提示。

---

## 2026-09-27 — 阶段 3：骨架布局与导航

**测试内容**：11 条路由可导航、文档标题、TabBar 显隐与高亮、Toast 容器挂载、设计令牌生效。

**操作步骤**

1. 编写 3 个 composable（`useToast` / `useMonth` / `useCurrency`）。
2. 编写 9 个基础 UI 组件（BaseButton / BaseInput / BaseSelect / BaseModal / PageShell / EmptyState / MonthPicker / AmountText / AppToast）。
3. 编写 `AppTabBar.vue`（4 个跳转项 + 中央记账按钮）与 `BudgetProgressBar.vue`。
4. 配置 11 条懒加载路由，`meta.title` / `meta.tab` 驱动标题与导航高亮。
5. 新建 `src/__tests__/app.test.ts` 覆盖上述验收点。
6. `npm run lint` → 3 处错误，修复后重跑。
7. 全量测试、类型检查、构建。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npx vitest run` | 9 个文件 252 条测试全部通过 |
| `npm run type-check` | 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 成功，每个视图独立分包（8 个视图 chunk） |

**过程中发现并修复的问题**

1. **`const props = withDefaults(...)` 但 script 中未引用 `props`**（lint 捕获，3 处）
   - 组件模板里直接用属性名，不需要 `props` 变量。改为不接收返回值的裸调用。

2. **路由单例跨用例残留**（冒烟测试捕获）
   - 现象：`TabBar 有 4 个跳转项` 用例失败，`findComponent` 返回空。
   - 原因：`router` 是模块级单例，上一个用例把路径停在 `/settings`（无 tab），下个用例挂载时 TabBar 因此不渲染。
   - 修复：`mountApp(initialPath)` 显式指定起始路径，保证用例起点一致。

**实现说明**

- TabBar 显隐由 `route.meta.tab` 驱动：表单类页面（记一笔 / 转账 / 预算 / 设置等）不显示，给表单腾出整屏。
- `BudgetProgressBar` 用 HTML + Tailwind 手写（不用图表库）：填充 <80% 用顺序蓝，>=80% 换 warning 黄，>=100% 换 critical 红，且**状态色始终带图标 + 文案**——浅色模式下 warning 对表面色对比度仅 1.79:1，单靠颜色不可读。
- `AppToast` 同样遵循「状态色必带图标」规则，左侧色条 + emoji + 文字三重表达。
- `PageShell` 统一页面头部与底部安全区留白，各视图只关心内容。

---

## 2026-09-27 — 阶段 4：记账核心

**测试内容**：记一笔 / 编辑 / 删除 / 筛选的完整链路，含金额分元换算、转账记录只读、预算跨线提示。

**操作步骤**

1. 编写 `useTransactionForm.ts`（三种模式：create / edit / readonly）与 `TransactionForm.vue`。
2. 编写 `useTransactionFilters.ts`、`TransactionList.vue`、`TransactionListItem.vue`。
3. 接通 `TransactionFormView.vue` 与 `TransactionsView.vue`。
4. 编写 3 个测试文件：表单逻辑、筛选分组、组件挂载。
5. `npx vitest run` → 3 条失败。
6. 定位并修复（见下），其中 1 条是真实缺陷。
7. 补一条端到端流程测试（记一笔 → 列表 → 筛选 → 进编辑页）。
8. 全量重跑测试、lint、类型检查、构建，并核对产物 CSS 的工具类。
9. 启动 dev server 确认新模块可正常编译。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npx vitest run` | 13 个文件 290 条测试全部通过（本阶段新增 38 条） |
| `npm run type-check` | 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 成功，85 个模块，205ms |
| dev server | HTTP 200，新增 SFC 正常编译 |
| 产物 CSS 工具类 | `bg-series-1/10`、`bg-hairline/60` 走 `color-mix`，并带 `@supports` 优雅降级；`!text-critical` 正确生成 |

**产物体积**：`TransactionsView` 7.27 kB、`TransactionFormView` 14.17 kB，均独立分包。

**过程中发现并修复的问题**

1. **编辑时切换收支方向会留下孤儿分类 —— 真实缺陷**
   - 现象：编辑一笔支出，把方向切到「收入」再保存，会存出「收入账目挂着支出分类」的记录；分类网格里看不到它，用户无从察觉。
   - 原因：清空分类的判据写成了「是否切换了方向」，为了不误伤编辑模式的载入过程，又加了 `mode === 'edit'` 直接 return，等于在编辑模式下彻底关掉了这层保护。
   - 修复：判据改为「已选分类是否仍在当前方向的可选列表里」。载入原值时类型和分类一起变、分类仍合法所以保留；用户手动切方向时分类不在列表里所以清空。两个场景都正确。
   - 影响：会污染统计数据（收入类别里冒出支出分类），且事后无法从界面看出异常。

2. **备注长度前后不一致** — 输入框 `maxlength` 是 60，`validateNote` 默认上限 50，用户能敲进去 60 个字却被拒绝保存。已统一为 50。

3. **Teleport 弹层在测试里查不到**（测试基建）
   - `BaseModal` 通过 Teleport 渲染到 `body`，`wrapper.findAll` 的范围不含它，删除确认按钮找不到。
   - 修复：用 `DOMWrapper` 直接查 `document.body`，并在测试里注释说明这是 Teleport 组件的通用姿势。

4. **筛选器的 watcher 是异步的**（测试）
   - `type` 变化清空 `categoryId` 由 `watch` 完成，默认 pre-flush 异步执行，用例需 `await nextTick()`。
   - 真实界面不受影响（渲染前已 flush）。

**实现说明**

- **表单三态**：新建 / 编辑 / 只读。转账记录进只读态，只展示金额、账户流向与备注，引导用户删除后重建——直接编辑单边会破坏配对。
- **金额校验**：`parseAmountText` 用字符串拼接换算为整数分，绕开浮点误差；失焦即校验，不用等到点保存。全角数字与全角句点由 `normalizeNumeric` 兜住，兼容中文输入法。
- **币种符号从 Intl 取**，不写死「¥」——账户是美元时显示 `US$`，显示错误符号比不显示更糟。
- **合计排除转账、列表包含转账**：列表里转账记录带「不计收支」角标，用户可以核对，但顶部三个数字与统计口径一致。
- **筛选不折叠**：类型 + 分类两个下拉一行放下，分类下拉首项是「全部分类」且随收支方向收敛。
- **`BaseSelect` 的 v-model 事件是 `string`**，绑到联合类型的 ref 上过不了类型检查，视图里用显式 handler 收窄。

---

## 2026-09-27 — 阶段 5：账户与转账

**测试内容**：账户增改归档、余额计算、同币种与跨币种转账、成对记录与级联删除、统计排除转账。

**操作步骤**

1. 给 `lib/validate.ts` 补 `parseSignedAmountText`（初始余额允许 0 与负数），并补单元测试。
2. 新建 `lib/presets.ts` 收纳图标与徽标配色预设，`db/seed.ts` 改为从那里取默认值。
3. 新建 `EmojiPicker.vue` / `ColorPicker.vue` 两个通用选择器。
4. 编写 `useAccountForm.ts` + `AccountForm.vue`、`useTransferForm.ts` + `TransferForm.vue`、`AccountCard.vue`。
5. 接通 `AccountsView.vue`（账户表单走弹层，不新增路由）与 `TransferFormView.vue`。
6. 编写 4 个测试文件：账户表单逻辑、转账表单逻辑、账户表单组件、账户与转账集成流程。
7. `npx vitest run` → 类型检查报 2 处测试夹具类型过窄，转账用例 3 处因缺 flush 失败。
8. 修复后全量重跑测试、lint、类型检查、构建。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npx vitest run` | 17 个文件 342 条测试全部通过（本阶段新增 47 条） |
| `npm run type-check` | 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 成功，`AccountsView` 10.17 kB、`TransferFormView` 7.77 kB，独立分包 |

**过程中发现并修复的问题**

1. **初始余额无法录入「0」和负数 —— 缺能力，非缺陷**
   - `parseAmountText` 要求金额必须为正，但信用卡欠款、透支账户的初始余额本就该是负数，新账户的初始余额也常是 0。
   - 修复：新增 `parseSignedAmountText`，允许 0 与负数，共用同一套字符串拼接换算与上限校验；顺手让 `normalizeNumeric` 认识全角减号与 Unicode 减号（中文输入法会打出这两种）。

2. **转入账户可以选成与转出相同 —— 交互设计问题**
   - 初版靠 watcher 在撞车时静默把转入账户挪到另一个，用户不会察觉自己的选择被改掉了；加校验报错又属于「选完才告诉你不许选」。
   - 修复：转入账户的下拉直接排除转出账户，从源头选不到；watcher 保留，负责在转出账户变化后把已撞车的转入值挪到有效项，保证下拉选中项始终有效。校验函数留作兜底（只有一个账户时会命中）。

3. **转账表单里重复实现了一遍余额计算**
   - 自己写了个 `accountBalanceOf`，而 `lib/stats.ts` 早就导出了经过测试的 `accountBalance`。已改为直接调用——统计口径只能有一个出处。

4. **测试夹具类型过窄**（类型检查捕获）
   - `addAccount(name, currency: 'CNY' | 'USD')` 写死了两个币种，用港币做用例时过不了类型检查。改用 `CurrencyCode`。

5. **汇率预填的 flush 时序**（测试）
   - 默认汇率由 watcher 在账户选齐后写入，改完账户立即断言读到的是上一次的 `'1'`。测试里统一用 `pick()` 辅助函数等待一拍。

6. **选择器选错按钮**（测试）
   - `button:not([aria-expanded])` 命中的是页头的「转账」按钮而非账户卡片。改为按文案定位。

7. **`AccountsView` 里的空状态是死代码** — 账户只归档不删除，种子数据也必有一个账户，`accounts.length === 0` 不可能成立。已删除。

**实现说明**

- **账户不提供删除，只归档**：删掉账户会让历史账目失去币种依据、余额再也算不出来。作为补偿，唯一在用的账户不允许归档（否则记账时无账户可选），按钮置灰并说明原因。
- **已有账目的账户锁定币种**：改币种等于把历史金额整体重新解释成另一种货币，余额与统计会凭空变化。界面上禁用，提交时也不再带上 `currency` 字段，避免绕过禁用态。
- **账户表单走弹层而非独立路由**：字段不多，就地编辑能保留账户列表的上下文，也省掉两条路由。
- **转账金额与汇率**：金额按转出账户币种输入；汇率是「1 单位转出币 = ? 单位转入币」，由当前汇率预填，用户改过之后不再覆盖（换账户也不覆盖）；同币种恒为 1，提交时忽略输入框里的残留值。
- **余额不足只提示不拦截**：允许透支，也允许用户先转账后补记。
- **转账生成一出一进两条记录**，共享 `transferId`：删除任意一条都会连带删除配对，统计口径排除转账，账户余额包含转账。

---

## 2026-09-27 — 阶段 6：预算与首页

**测试内容**：预算列表与进度状态、80%/100% 两处临界的状态色与文案切换、预算的增改删、跨月独立、沿用上月、首页预算提醒与本月概览、记账跨线 toast 只弹一次。

**操作步骤**

1. 新建 `src/lib/status.ts`：把「状态色 + 图标 + 文案」三者绑成一条记录，`BudgetProgressBar` 改为从这里取。
2. 新建 `src/features/budgets/useBudgetManager.ts`（列表聚合 + 沿用上月）与 `useBudgetEditor`（弹层表单）。
3. 新建 `src/features/budgets/BudgetManager.vue`，接通 `BudgetsView.vue`（MonthPicker + 预算管理）。
4. 新建 `src/features/dashboard/useDashboard.ts` 与 `BudgetAlertList.vue`，重建 `DashboardView.vue`（本月结余 / 收支 / 环比、预算提醒、最近记录）。
5. 编写 4 个测试文件：预算逻辑、预算组件、首页数据、预算与首页的集成流程。
6. `npx vitest run` → 2 条组件断言失败，另有 1 条被 `npm run type-check` 拦下。
7. 逐一修复（见下），全量重跑测试、lint、类型检查、构建，并核对产物 CSS 的工具类。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npx vitest run` | 21 个文件 394 条测试全部通过（本阶段新增 52 条） |
| `npm run lint` | 通过 |
| `npm run type-check` | 通过 |
| `npm run build` | 成功，`BudgetsView` 6.08 kB、`DashboardView` 5.05 kB，主 chunk 114.08 kB |
| 产物 CSS 工具类 | `active:bg-hairline/50`、`text-critical`、`text-delta-up/down` 均已生成 |

**过程中发现并修复的问题**

1. **进度条的无障碍名称是一串金额 —— 真实缺陷**
   - 现象：读屏念出来是「¥850.00 / ¥1,000.00，进度 85%」，没有说明这是**哪个**分类的进度。
   - 原因：`aria-label` 直接用了可见的 `label`（金额对比），而这个值当初只是为了显示。
   - 修复：新增 `name` 属性专供无障碍名称，缺省回落到 `label`，再回落到「预算使用进度」。预算列表里传分类名。

2. **「沿用上月预算」会覆盖本月已设的限额**
   - 界面上只在「本月一条预算都没有」时才给按钮，当下触发不到；但这个动作本身是有破坏性的，一旦以后放宽入口就会把用户定好的限额悄悄冲掉。
   - 修复：改为只补本月还没有的分类，并返回实际写入的条数（toast 里如实报数）。

3. **`Array.prototype.at` 超出 tsconfig 的 lib**（类型检查捕获，lint 没报）
   - 现象：测试里 `items.at(-1)` 报 TS2550，提示需要 es2022 lib。
   - 修复：改用 `items[items.length - 1]`。这类错误只有类型检查能拦，说明 lint 与 type-check 两道都得跑。

4. **首页断言被「最近记录」里的同名分类带偏**（测试定位问题）
   - 现象：断言首页预算提醒「不含交通」失败——交通出现在下方的最近记录里。
   - 修复：新增 `alertSection()` 辅助函数，把断言限定在预算提醒区块内部。

**实现说明**

- **状态色的三件套绑在一起**：`lib/status.ts` 里一条记录同时给出图标、文案、填充色。浅色模式下 warning 对表面色只有 1.79:1 对比度，颜色单用是不可读的，绑在一起才不会有人只取颜色。
- **进度条最多铺满 100%**：超支再多也用文案表达（「已超支」+ 百分比），条子不会溢出容器。
- **预算按月独立**：`Budget` 带 `month` 字段，翻月份看到的是那个月自己的预算；首页固定看**当前自然月**，不跟随 `useMonth` 的浏览月份——账单页翻到八月，回首页不该看到八月的提醒。
- **编辑预算时分类锁定**：换成另一个分类等于把限额挪走，语义混乱；新增时已设过预算的分类也不出现在候选里，避免「添加」变成「覆盖」。
- **没有二次确认的删除**：删预算只丢一个限额数字，随手能重建；账目删除要确认是因为它销毁的是历史。
- **首页 KPI（本月结余 / 收支 / 环比）与最近记录提前到本阶段**：这些是纯 HTML，不依赖图表库，先把首页填满便于走通完整流程；阶段 7 只剩两个图表组件与统计页。
- **跨线 toast 只弹一次**：判定逻辑在阶段 2 的 store 里（比较记账前后的状态档位），本阶段补了组件级用例锁定——越过 80% 弹 warning、越过 100% 弹 over、已在超支状态继续记账只提示「记好了」。

---

## 2026-09-27 — 阶段 7：统计图表

**测试内容**：月度收支趋势（近 6 / 12 月切换、双系列单轴、图例、转账排除、与账单口径对账）、分类支出占比（段数、折叠「其余 N 类」、颜色跟分类实体、窄段不标注、悬停/点按读数、明细表联动、无障碍名称）、空状态与缺汇率提示、深浅两套图表令牌解析。

**操作步骤**

1. 新建 `src/lib/echarts.ts`（按需注册 BarChart + Grid/Tooltip/Legend + CanvasRenderer）。
2. 新建 `src/composables/useChartTheme.ts`：把 CSS 变量解析成**具体色值**——canvas 画不了 `var(--x)`；`prefers-color-scheme` 变化时重解析。
3. 新建 `src/components/charts/types.ts`（`TrendPoint` / `ShareItem`），让图表组件不依赖 store。
4. 新建 `src/features/stats/useStats.ts`（趋势窗口 + 占比装配 + 槽位色分配），`src/components/charts/MonthlyTrendChart.vue`（ECharts）与 `CategoryShareChart.vue`（HTML/Tailwind 手写堆叠条）。
5. 重写 `src/views/StatsView.vue`：月份选择器 + 区间分段开关 + 两张卡片 + 空状态 + 缺汇率提示。
6. 补 `lib/` 单测（`inlinePercentFits`、`formatCompactYuan`、折叠段 `count`），新建 `useStats.test.ts`（14 条）与 `stats-flow.test.ts`（19 条，桩掉 `vue-echarts` 直接断言 option）。
7. 对照 dataviz skill 的反模式清单自查，逐条修（见下）。
8. 全量重跑测试、lint、类型检查、构建，并核对产物 CSS 的工具类。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npx vitest run` | 23 个文件 **433 条**测试全部通过（本阶段新增 39 条） |
| `npm run lint` | 通过 |
| `npm run type-check` | 通过 |
| `npm run build` | 成功，`StatsView` 530.05 kB（gzip 180.48 kB），主 chunk 114.51 kB |
| 产物 CSS 工具类 | `border-radius:2px`、`before:absolute/-top-1.5/-bottom-1.5/content-['']` 均已生成 |

**过程中发现并修复的问题**

1. **悬停读数移出后不归位 —— 真实缺陷**
   - 现象：鼠标移出色段，读数仍停在某个分类上，回不到「合计」。
   - 原因：`mouseleave` 挂在色段的父级 `.pt-4` 容器上，而这个元素比色段高 16px；更关键的是 `mouseleave` 不冒泡。
   - 修复：把 `@mouseleave` 移到色段容器（`[role="img"]`）自身——语义也更对：离开条形图才清除。

2. **12 月区间测试假通过**（测试定位问题）
   - 现象：切换区间后报「趋势图没有拿到 option」。种子把数据种在 11 个月前，默认 6 个月窗口是空的，`v-if="hasTrendData"` 整块（连图表）都没渲染。
   - 修复：数据改种在当前月；另加一条回归用例，断言默认窗口为空时区间开关**仍然可达**。

3. **两张表抢 `wrapper.get('table')`**（测试定位问题）
   - 现象：`tbody tr` 数出 9 行而不是 3 行——趋势图也带数据表，两个表都被匹配到。
   - 修复：加 `tableWith(w, header)` 辅助，按表头文字（`月份` / `分类`）限定。

4. **工具返回类型注解触发 TS2740**（类型检查捕获）
   - 现象：`bar()` / `tableWith()` 声明 `: DOMWrapper<Element>` 报错，`findAll().find()` 返回的是 `Omit<DOMWrapper<Element>, 'exists'>`。
   - 修复：去掉显式返回类型，交给推断。

5. **误报：构建产物里「找不到」`rounded-[2px]` 与 `before:*`**
   - 现象：按转义括号 grep 产物 CSS 一无所获，一度以为 Tailwind 没生成这些类。
   - 原因：shell 对 `\[` 做了二次转义。按规则签名（`border-radius:2px`、`--tw-content`）重查，全部存在。**核对产物要用规则签名，别用类名原文。**

**实现说明**

- **偏离计划：占比条用 HTML/Tailwind 手写，不是 ECharts。** 最多 8 段、只有一条轴，用画布要付出三层代价：jsdom 里测不了（只能桩掉再看 option）、12px 高色块内的标注会被裁、读屏拿不到结构。与项目里已有的手写预算 meter 保持一致。收益是悬停/点按/明细表联动都能被真实断言。
- **偏离计划：段内标注阈值从「>=8%」调整到约 12%。** 计划里的 8% 是在桌面宽度下估的；按最窄的 320px 视口算，色段可用宽度约 250px，2 字符标签（`8%`）需 `2×7+8=22px`，对应阈值 ≈11.6%，8% 段只有 20px——标注会贴到相邻段上。改为 `inlinePercentFits()` 按实际估算判定，宁可少标不可重叠；窄段的值由下方明细表兜住，信息不丢。
- **颜色跟分类实体走，不跟金额排名走。** `assignSeriesSlots(可见分类, 全部支出分类)` 按分类的固定次序发槽位，某个月金额排名颠倒，颜色也不会重排。已用「颠倒排名后颜色不变」的用例锁死。
- **折叠段叫「其余 N 类」而不是「其他」。** 种子数据里本来就有一个叫「其他」的分类，两者同名会让人分不清。为此给 `CategorySlice` 加了 `count` 字段（未折叠恒为 1，折叠段是被折进去的分类数）。
- **trend 图带 `<details>` 数据表、占比图常驻明细表。** 浅色模式下 `--series-2` 对表面色是 2.74:1（对比度 WARN）。按 dataviz 规则，WARN 必须有可见标签或表格视图兜底，不可忽略。
- **四个大号独立数字去掉 `tabular-nums`。** 等宽数字是为**竖向对齐的列**准备的；首页余额、预算合计、账户总额、我的页总额都是孤立的大数字，等宽反而让 `121` 这类数字显得松散。金额输入框与账目列表仍保留。
- **图例键改成方角。** 色块是矩形，图例键用圆点是形状错配；统一 `rounded-[2px]`。
- **色段命中区扩到 24px。** 色块本体只有 12px 高，用 `before:` 伪元素上下各外扩 6px 补齐触摸目标。
- **点按切换读数。** 手机上不存在悬停，只做 `mouseenter` 等于该功能在移动端不存在。
- **已知待决：`StatsView` 单 chunk 530 kB（gzip 180 kB），触发 Vite 的 500 kB 警告。** 全是 ECharts，且已随路由懒加载（首屏主 chunk 仍只有 114 kB）。可选处置见下阶段。

---

## 2026-09-27 — 阶段 8：分类管理、设置页与文案复查

**测试内容**：分类的增改删与引用计数、被引用时拒绝删除、已有分类锁定收支类型、汇率维护（列出哪些币种、失焦提交、清空即撤销、改完汇率首页金额跟着变）、清空数据的二次确认与回到种子状态、子页面的返回入口、中文文案复查。

**操作步骤**

1. 新建 `src/features/categories/useCategoryManager.ts`（列表 + 编辑器）与 `CategoryManager.vue`，接通 `CategoriesView.vue`。
2. 新建 `src/features/settings/useExchangeRates.ts`、`ExchangeRateList.vue`、`DataSection.vue`，重建 `SettingsView.vue`。
3. 把徽标底色的重复逻辑抽成 `lib/presets.ts` 的 `badgeStyle()`，三处调用点统一。
4. 给 `/accounts`、`/budgets`、`/categories`、`/settings` 补上返回入口。
5. 通读全部界面文案，修掉两处与事实不符／不通顺的句子。
6. 编写 5 个测试文件：分类逻辑、分类流程、汇率逻辑、设置页流程、徽标底色。
7. 跑全量测试、lint、类型检查、构建，并起 `vite preview` 确认产物可访问。

**结果**：全部通过 ✅

| 检查项 | 结果 |
|---|---|
| `npx vitest run` | 28 个文件 **484 条**测试全部通过（本阶段新增 51 条） |
| `npm run lint` | 通过 |
| `npm run type-check` | 通过 |
| `npm run build` | 成功，`SettingsView` 5.65 kB、`CategoriesView` 5.31 kB，主 chunk 114.51 kB |
| `vite preview` | `http://localhost:4173/` 返回 200，`dist/` 可静态托管 |

**过程中发现并修复的问题**

1. **四个子页面没有返回入口 —— 真实缺陷**
   - 现象：`/accounts`、`/budgets`、`/categories`、`/settings` 都从「我的」进去，但这些路由不设 `meta.tab`，所以既没有底部导航、也没有返回箭头。用户点进去以后，除了浏览器的返回手势没有别的出路。
   - 原因：`PageShell` 的 `back` 属性默认关闭，而这四个页面都没传。
   - 修复：四个页面统一加上 `back`。判断规则很简单 —— **有 TabBar 的页面不需要返回箭头，没有的必须有**。

2. **徽标底色逻辑重复三处，其中一处还没做校验**
   - 现象：`AccountCard` 与 `TransactionListItem` 各自写了一份「校验 hex → 拼透明度 → 非法退回分隔线色」，新写的分类列表又写了第三份，而且**漏了校验**（直接拼 `${color}22`）。
   - 影响：色值来自用户数据，localStorage 被改坏或迁移留下脏值时，未校验的那份会渲染出一块不可见的透明。
   - 修复：抽成 `lib/presets.ts` 的 `badgeStyle()`，三处统一调用，并补单测覆盖非法输入。

3. **统计页空状态写死了「最近 6 个月」**
   - 现象：切到「近 12 月」，空状态仍然说「最近 6 个月没有收支记录」。
   - 修复：文案跟着 `range` 走。

4. **转账空状态文案不通顺**：「转账是账户之间的操作，先再建一个账户」——「先再」是病句。改为「转账发生在两个账户之间，去账户管理再建一个」，同时把目标按钮的名字写进了句子里。

5. **测试断言方式本身不成立**：用 `expect(helper('支出')).toBeUndefined()` 断言按钮不存在，但 helper 找不到就抛错，断言永远走不到。改成直接在弹层 DOM 里筛按钮文字列表，断言长度为 0。

6. **类型检查拦下一处真实类型错误**：`TransactionInput.categoryId` 是 `string`（转账那条另走 `addTransfer`），测试里写了 `?? null`。只有 `npm run type-check` 能拦住这类问题 —— lint 不报。

**实现说明**

- **汇率只列「用到的 + 已设过的」币种**，不是十个全列。用到的包含**已归档账户**的币种（历史账目仍要折算）；已设过的即使没有账户也保留（否则设完再归档就再也看不到、清不掉）。少了会导致「未设置汇率」的提示点进来却无处可填，多了会让人以为每个币种都得填。
- **失焦才提交汇率。** 边打字边解析会把「7.」这种中间态判成非法，用户还没输完就被标红。
- **清空输入框等于取消设置**（回到 1:1 兜底），不当作错误 —— 否则用户没有任何办法撤销一个已设的汇率。
- **分类被引用时拒绝删除，已有分类锁定收支类型。** 两条规则都是保护历史数据：删掉会让账目变成无分类的孤儿，改类型会让它挂在一个方向不符的分类下、筛选器里再也找不到。界面上给出的是**原因**，不是灰掉的按钮。
- **同类型下拒绝重名**（不同类型同名放过：支出「其他」与收入「其他」是两回事）。
- **清空数据是不可恢复的**，所以二次确认里把要销毁的数量先摆出来（账目 / 账户 / 分类 / 预算各多少），而不是只说一句「确定吗」。
- **补上了数据损坏提示。** `db/index.ts` 早就实现了「损坏 → 备份 → 重建」，但 `recoveryReason()` 从来没被任何界面调用过 —— 用户会以为账目是自己消失的。现在设置页会说明发生了什么、以及原始内容还留在浏览器里。
- **文案复查原则**：短标签不加句号，完整句子加；状态与结果用「已…」，动作与引导用动词开头；面向用户说「账目 / 分类 / 账户」，不说「记录 / 标签 / 卡片」。
- **未处置的待决点保持不变**：`StatsView` 依旧是一个 530 kB 的路由 chunk，全部来自 ECharts。已是最小按需注册，再拆只能换成手绘 canvas —— 不值。首屏主 chunk 仍是 114.51 kB，统计页是懒加载，不访问就不下载。
