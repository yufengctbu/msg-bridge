---
name: msg-bridge-conventions
description: >
  msg-bridge 项目专属编码约定。修改代码、新增功能、重构、添加路由、添加中间件、
  添加工具函数时必须加载。Use when: editing any source file in this project,
  adding routes or middleware, writing TypeScript, handling responses or errors.
---

# msg-bridge 编码约定

## Import

无 `.js` 后缀，无 `/index`：`import { config } from '../config'`

## 目录职责

| 目录 | 职责 | 禁止 |
|---|---|---|
| `config/` | 环境变量唯一出口 | 散落 `process.env` |
| `middleware/` | 单一关注点，独立文件 | 内联在路由回调里 |
| `services/` | 业务逻辑 | import `express`，操作 `req`/`res` |
| `utils/` | 纯工具函数 | import 业务模块 |
| `routes/` | 路由 + 注册表 | 在 `app.ts` 直接挂载 |

**新增逻辑先问：能放 `utils/` 或 `services/` 吗？**

## 响应格式

禁止裸 `res.json()`，统一用 `src/utils/response.ts` 的 `sendSuccess` / `sendFail`。  
→ [详细用法与示例](./references/response-format.md)

## 路由注册

新路由加在 `src/routes/index.ts` 的 `modules` 数组，前缀改 `API_PREFIX` 一处生效。  
→ [路由文件模板与 catch 规范](./references/routing.md)

## 错误处理

| 场景 | 写法 |
|---|---|
| 路由异常 | `try/catch` → `next(err)` |
| 参数校验失败 | `sendFail(res, '...'); return;` |
| 中间件拒绝 | `sendFail(res, '...', 401); return;`（**不调用 `next(err)`**） |
| 全局兜底 | `src/middleware/errorHandler.ts` 统一处理 |

## 命名与代码风格

→ [命名规范、导入顺序与 TypeScript 规则](./references/naming-and-style.md)

**简要：**
- 函数：动词 + 名词 — `sendSuccess`、`extractMsgKey`
- 布尔：`is`/`has`/`can` 前缀 — `isDuplicate`
- 常量：`UPPER_SNAKE_CASE`；类型：`PascalCase`；文件：`camelCase.ts`

## 中间件规范

单一关注点，独立文件，不内联在路由回调里。  
→ [中间件模板与规范](./references/middleware.md)

## 完成检查

- [ ] Import 无 `.js` 后缀
- [ ] JSON 响应用 `sendSuccess` / `sendFail`
- [ ] 函数名语义化（动词 + 名词）
- [ ] 可复用逻辑在 `utils/` 或 `services/`
- [ ] 新路由在 `modules` 数组注册
- [ ] `pnpm build` 零错误


## 执行流程

拿到任务后，**按顺序**完成以下步骤：

1. 读取相关文件，理解现有结构
2. 根据下方规范判断放在哪个目录、用什么函数
3. 实现代码，应用所有规范
4. 对照末尾[检查清单](#检查清单)逐项核对
5. 运行 `pnpm build` 确认无编译错误

---

## 技术栈速查

| 工具 | 版本/配置 |
|---|---|
| Express | 5.x |
| TypeScript | `strict: true`，`moduleResolution: Bundler` |
| 开发运行 | `tsx watch src/index.ts` |
| 生产构建 | `tsup`（esbuild，产物在 `dist/`） |
| 环境变量 | 统一从 `src/config/index.ts` 读取，**不在代码中散落 `process.env`** |

**Import 规则：无 `.js` 后缀，无 `/index`**

```typescript
// ✅
import { config } from '../config';
import { sendSuccess } from '../utils/response';

// ❌
import { config } from '../config/index.js';
```

---

## 目录职责边界

```
src/
├── config/       唯一环境变量出口
├── middleware/   Express 中间件，单一关注点，独立文件
├── queue/        后台逻辑（缓存、去重等）
├── routes/       路由文件 + 统一注册表 index.ts
├── services/     业务逻辑，禁止 import express / 操作 req/res
├── types/        全局类型定义
└── utils/        纯工具函数，无副作用，可独立测试
```

**跨层引用禁止规则：**

- `services/` → 不能 import `express`
- `utils/` → 不能 import 任何业务模块（`services/`、`routes/` 等）
- 新增逻辑先问：能放 `utils/` 或 `services/` 吗？不能才放路由回调里

---

## 响应格式规范

> **强制**：所有 JSON 响应必须使用 `src/utils/response.ts`，**禁止直接调用 `res.json()`**

```typescript
import { sendSuccess, sendFail } from '../utils/response';

// 成功 → { ok: true, data: T | null }
sendSuccess(res);                      // 200 { ok: true, data: null }
sendSuccess(res, { id: 1 });           // 200 { ok: true, data: { id: 1 } }
sendSuccess(res, { id: 1 }, 201);      // 201 { ok: true, data: { id: 1 } }

// 失败 → { ok: false, code: number, message: string }
sendFail(res, 'openid 必填');          // 400 { ok: false, code: 400, message: '...' }
sendFail(res, '鉴权失败', 401);        // 401 { ok: false, code: 401, message: '...' }
sendFail(res, '服务不可用', 503);      // 503 { ok: false, code: 503, message: '...' }
```

**禁止的写法：**

```typescript
res.json({ ok: true });                    // ❌
res.status(400).json({ error: '...' });   // ❌
res.json({ code: 0, msg: 'ok' });         // ❌ 自创结构
```

---

## 路由规范

### 1. 路由注册表（`src/routes/index.ts`）

**所有路由在此集中注册，不得在 `app.ts` 直接挂载。**

```typescript
const API_PREFIX = '';   // 改此处即可全局生效，如 '/api/v1'

const modules: RouteModule[] = [
  { path: '/wechat', router: wechatRouter, description: '微信消息接入' },
  // 新增模块：在此添加一行，其他文件不需要改动
];
```

### 2. 路由文件结构（`src/routes/*.ts`）

```typescript
// ── 1. Import 顺序：express → 中间件 → services → utils → types ──
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { callbackAuth } from '../middleware/callbackAuth';
import { doSomething } from '../services/something';
import { sendSuccess, sendFail } from '../utils/response';
import type { MyType } from '../types/xxx';

export const myRouter: Router = Router();

// ── 2. 每个端点之间空一行，端点上方写简短注释 ──

/** GET / - 说明用途 */
myRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await doSomething();

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

/** POST /action - 说明用途，注明鉴权要求 */
myRouter.post('/action', callbackAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body as { id?: string };

    if (!id) {
      sendFail(res, 'id 必填');
      return;
    }

    await doSomething();
    sendSuccess(res);
  } catch (err) {
    next(err);
  }
});
```

---

## 中间件规范

- 每个中间件独立文件，文件名描述其功能（`callbackAuth.ts`、`verifySignature.ts`）
- 使用 `sendFail` 终止，**不调用 `next(err)`**（鉴权失败不是系统错误）
- 签名必须标注返回类型 `void`

```typescript
export function myMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!valid) {
    sendFail(res, '鉴权失败', 401);
    return;    // 明确终止
  }

  next();      // 明确放行
}
```

---

## 工具函数规范

**满足以下任一条件即应提取到 `src/utils/`：**

- 在 ≥2 处使用
- 逻辑 ≥5 行
- 可以独立测试

**工具函数必须：**

- 语义化命名（见命名规范）
- 标注返回类型
- 有 JSDoc（参数含义不明显时加 `@example`）

---

## 错误处理规范

| 场景 | 做法 |
|---|---|
| 路由异步异常 | `try/catch` → `next(err)` → 由 `errorHandler` 统一处理 |
| 参数校验失败 | `sendFail(res, '...') + return`，**不抛异常** |
| 中间件终止 | `sendFail(res, '...') + return`，**不调用 `next(err)`** |
| 全局兜底 | `src/middleware/errorHandler.ts`，使用 `sendFail` 输出 |

---

## 命名规范

### 函数：动词 + 名词，语义化

| ✅ 正确 | ❌ 错误 | 场景 |
|---|---|---|
| `sendSuccess` | `ok` / `respond` | 发送成功响应 |
| `sendFail` | `error` / `fail` | 发送失败响应 |
| `extractMsgKey` | `getKey` / `parse` | 提取消息去重键 |
| `registerRoutes` | `setup` / `init` | 注册路由 |
| `callbackAuth` | `auth` / `check` | 回调鉴权中间件 |
| `handleMessage` | `process` / `deal` | 处理消息 |
| `isDuplicate` | `check` / `dup` | 是否重复 |

### 变量 / 常量 / 类型

| 类型 | 规范 | 示例 |
|---|---|---|
| 布尔值 | `is` / `has` / `can` 前缀 | `isDuplicate`、`isProduction` |
| 常量 | `UPPER_SNAKE_CASE` | `API_PREFIX`、`TTL_MS` |
| 类型/接口 | `PascalCase` | `WechatReply`、`AppError` |
| 文件名 | `camelCase.ts` | `errorHandler.ts`、`dedupCache.ts` |

---

## 代码风格规范

### 必须加空行的场景

1. import 块结束后
2. 常量/变量声明块结束后
3. 含 `return` 的守卫 `if` 语句后
4. 函数内逻辑阶段切换时（校验 → 处理 → 响应）
5. 相邻函数 / 导出定义之间

```typescript
// ✅
export function callbackAuth(req: Request, res: Response, next: NextFunction): void {
  const token = config.forward.callbackToken;

  if (!token) {
    sendFail(res, '端点不可用', 503);
    return;
  }

  if (req.headers['x-callback-token'] !== token) {
    sendFail(res, '鉴权失败', 401);
    return;
  }

  next();
}

// ❌ 缺少空行，逻辑堆叠
export function callbackAuth(req: Request, res: Response, next: NextFunction): void {
  const token = config.forward.callbackToken;
  if (!token) {
    sendFail(res, '端点不可用', 503);
    return;
  }
  if (req.headers['x-callback-token'] !== token) {
    sendFail(res, '鉴权失败', 401);
    return;
  }
  next();
}
```

### 注释风格

- **函数/文件级别**：JSDoc `/** ... */`，说明用途与关键参数
- **行内逻辑**：`// 单行`，解释"为什么"而非"是什么"
- **区域分隔**（长文件）：`// ── 章节名 ──────`

---

## TypeScript 规范

| 规则 | 说明 |
|---|---|
| `strict: true` | 不允许隐式 `any` |
| `import type` | 纯类型导入用 `import type`，不引入运行时依赖 |
| 返回类型 | 中间件和路由回调必须标注（`void` / `Promise<void>`） |
| 可选链 | 优先 `?.` 和 `??`，避免手动 null 检查 |
| 类型断言 | 仅在无法推断时用 `as`，**禁止用 `as any` 绕过类型系统** |

---

## 检查清单

完成代码修改后，逐项确认：

- [ ] Import 无 `.js` 后缀，无 `/index`
- [ ] 所有 JSON 响应使用 `sendSuccess` / `sendFail`，无裸 `res.json()`
- [ ] 函数名语义化（动词 + 名词）
- [ ] 中间件逻辑独立文件，未内联在路由里
- [ ] 可复用逻辑已提取到 `utils/` 或 `services/`
- [ ] 新路由已在 `routes/index.ts` 的 `modules` 数组注册
- [ ] 逻辑块之间有空行分隔
- [ ] 函数有 JSDoc 注释
- [ ] 无 `any`，类型明确
- [ ] `pnpm build` 零编译错误


## 目录

- [项目技术栈](#项目技术栈)
- [目录结构约定](#目录结构约定)
- [响应格式规范](#响应格式规范)
- [路由规范](#路由规范)
- [中间件规范](#中间件规范)
- [工具函数规范](#工具函数规范)
- [错误处理规范](#错误处理规范)
- [命名规范](#命名规范)
- [代码风格规范](#代码风格规范)
- [TypeScript 规范](#typescript-规范)

---

## 项目技术栈

| 工具 | 用途 |
|---|---|
| Express 5 | HTTP 服务框架 |
| TypeScript | 严格模式，`moduleResolution: Bundler` |
| tsx | 开发运行（`pnpm dev`） |
| tsup | 生产构建（`pnpm build`） |
| dotenv | 环境变量，统一从 `src/config/index.ts` 读取 |

**import 写法：** 无需 `.js` 后缀，无需 `/index`。

```typescript
// ✅ 正确
import { config } from '../config';
import { sendSuccess } from '../utils/response';

// ❌ 错误
import { config } from '../config/index.js';
import { sendSuccess } from '../utils/response.js';
```

---

## 目录结构约定

```
src/
├── config/          # 环境变量统一读取，唯一出口
├── middleware/      # Express 中间件，每个关注点独立文件
├── queue/           # 非路由的独立后台逻辑（缓存、队列等）
├── routes/          # 路由模块 + 统一注册表
├── services/        # 业务逻辑，不直接操作 req/res
├── types/           # 全局类型定义
└── utils/           # 纯工具函数，无副作用，可独立测试
```

**原则：**

- `services/` 不能 import `express`，不操作 `req`/`res`
- `utils/` 函数必须是纯函数或无副作用的工具，不能 import 业务模块
- `middleware/` 每个中间件只负责单一关注点（鉴权、日志、签名验证等）
- 新增功能优先考虑是否能抽到 `utils/` 或 `services/`，而非堆在路由里

---

## 响应格式规范

**所有 JSON 响应必须通过 `src/utils/response.ts` 的统一函数输出，禁止直接调用 `res.json()`。**

### 成功响应

```typescript
import { sendSuccess } from '../utils/response';

// 有数据
sendSuccess(res, { openid: 'oXxx' });
// → 200 { ok: true, data: { openid: 'oXxx' } }

// 无数据（操作成功）
sendSuccess(res);
// → 200 { ok: true, data: null }

// 自定义状态码
sendSuccess(res, { id: 1 }, 201);
// → 201 { ok: true, data: { id: 1 } }
```

### 失败响应

```typescript
import { sendFail } from '../utils/response';

sendFail(res, 'openid 必填');           // → 400 { ok: false, code: 400, message: 'openid 必填' }
sendFail(res, '鉴权失败', 401);         // → 401 { ok: false, code: 401, message: '鉴权失败' }
sendFail(res, '服务不可用', 503);       // → 503 { ok: false, code: 503, message: '服务不可用' }
```

### 禁止的写法

```typescript
// ❌ 禁止直接 res.json()
res.json({ ok: true });
res.status(400).json({ error: '参数错误' });
res.json({ status: 'ok' });

// ❌ 禁止自创响应结构
res.json({ success: true, result: data });
res.json({ code: 0, msg: 'ok' });
```

---

## 路由规范

### 注册表集中管理

所有路由在 `src/routes/index.ts` 的 `modules` 数组中统一注册，**不得在 `app.ts` 或其他位置直接挂载路由**。

```typescript
// src/routes/index.ts
const API_PREFIX = '';  // 修改此处即可全局生效，如 '/api/v1'

const modules: RouteModule[] = [
  { path: '/wechat', router: wechatRouter, description: '微信消息接入' },
  // 新增模块只需在此添加一行
];
```

### 路由文件结构

每个路由文件（如 `routes/wechat.ts`）的要求：

1. **顶部集中 import**，顺序：express → 中间件 → services → utils → types
2. **每个端点用一个空行分隔**
3. **端点上方保留简短注释**（一行或 JSDoc），说明用途和鉴权要求
4. **业务逻辑不写在路由回调里**，提取到 `services/`

```typescript
// ✅ 正确示例
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { callbackAuth } from '../middleware/callbackAuth';
import { doSomething } from '../services/something';
import { sendSuccess, sendFail } from '../utils/response';

export const exampleRouter: Router = Router();

/** GET / - 获取列表 */
exampleRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await doSomething();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

/** POST /send - 发送消息，需 X-Callback-Token 鉴权 */
exampleRouter.post('/send', callbackAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body as { id?: string };

    if (!id) {
      sendFail(res, 'id 必填');
      return;
    }

    await doSomething();
    sendSuccess(res);
  } catch (err) {
    next(err);
  }
});
```

---

## 中间件规范

- 每个中间件独立文件，文件名与中间件功能一致（如 `callbackAuth.ts`、`verifySignature.ts`）
- 使用 `sendFail` 返回错误，**不抛异常、不调用 `next(err)`**（中间件鉴权失败直接 return）
- 签名：`(req, res, next): void`，必须标注返回类型
- 通过调用 `next()` 放行，通过 `return` 终止

```typescript
// ✅ 正确
export function myAuth(req: Request, res: Response, next: NextFunction): void {
  if (!valid) {
    sendFail(res, '鉴权失败', 401);
    return;           // 明确终止
  }
  next();             // 明确放行
}
```

---

## 工具函数规范

工具函数放在 `src/utils/` 下，按关注点分文件：

| 文件 | 用途 |
|---|---|
| `response.ts` | HTTP 响应格式化（`sendSuccess` / `sendFail`） |
| `xml.ts` | XML 解析相关工具（`extractMsgKey` 等） |

**新增工具函数的条件：**

1. 在两处以上使用，或
2. 逻辑超过 5 行，或
3. 可以独立测试

**函数必须有：**

- 清晰的语义化名称（见[命名规范](#命名规范)）
- `@example` 注释（若参数用法不明显）
- 明确的返回类型标注

---

## 错误处理规范

### 路由层

路由回调统一用 `try/catch`，catch 里调用 `next(err)` 交给全局 errorHandler。

```typescript
async (req, res, next) => {
  try {
    // 业务逻辑
  } catch (err) {
    next(err);   // 统一交给 errorHandler
  }
}
```

### 全局 errorHandler

`src/middleware/errorHandler.ts` 是唯一的错误兜底，使用 `sendFail` 输出，**不在其他地方自定义错误响应格式**。

### 参数校验

路由层做参数校验，校验失败用 `sendFail` + `return`，不抛异常：

```typescript
if (!openid || typeof openid !== 'string') {
  sendFail(res, 'openid 必填');
  return;
}
```

---

## 命名规范

### 函数命名语义化

函数名必须清晰表达其行为，**动词 + 名词** 结构：

| 场景 | ✅ 正确 | ❌ 错误 |
|---|---|---|
| 发送成功响应 | `sendSuccess` | `ok`, `respond`, `success` |
| 发送失败响应 | `sendFail` | `error`, `fail`, `bad` |
| 提取消息去重键 | `extractMsgKey` | `getMsgId`, `getKey`, `parse` |
| 注册所有路由 | `registerRoutes` | `setup`, `init`, `mount` |
| 校验回调令牌 | `callbackAuth` | `auth`, `check`, `verify` |
| 处理消息 | `handleMessage` | `process`, `deal`, `run` |

### 变量命名

- 布尔值：`is` / `has` / `can` 前缀，如 `isDuplicate`、`isProduction`
- 常量：`UPPER_SNAKE_CASE`，如 `API_PREFIX`、`TTL_MS`、`MAX_TIMESTAMP_AGE`
- 类型/接口：`PascalCase`，如 `WechatReply`、`RouteModule`、`AppError`

### 文件命名

- `camelCase.ts`，如 `errorHandler.ts`、`callbackAuth.ts`、`dedupCache.ts`
- 路由文件以模块功能命名，不加 `Router` 后缀，如 `wechat.ts`、`user.ts`

---

## 代码风格规范

### 空行分隔

代码块之间必须用空行分隔，提升可读性：

```typescript
// ✅ 正确 —— 逻辑块之间有空行
export function callbackAuth(req: Request, res: Response, next: NextFunction): void {
  const token = config.forward.callbackToken;

  if (!token) {
    sendFail(res, 'CALLBACK_TOKEN 未配置，此端点不可用', 503);
    return;
  }

  if (req.headers['x-callback-token'] !== token) {
    sendFail(res, '鉴权失败', 401);
    return;
  }

  next();
}

// ❌ 错误 —— 逻辑堆在一起，缺少空行
export function callbackAuth(req: Request, res: Response, next: NextFunction): void {
  const token = config.forward.callbackToken;
  if (!token) {
    sendFail(res, 'CALLBACK_TOKEN 未配置，此端点不可用', 503);
    return;
  }
  if (req.headers['x-callback-token'] !== token) {
    sendFail(res, '鉴权失败', 401);
    return;
  }
  next();
}
```

**必须加空行的场景：**

1. import 块结束后
2. 常量/变量声明块结束后
3. 每个 `if` 分支结束后（特别是含 `return` 的守卫语句）
4. 函数内逻辑阶段切换时（如"参数校验" → "业务处理" → "响应返回"）
5. 同一文件中相邻的函数/类定义之间

### 注释风格

- **文件/函数级别**：JSDoc `/** ... */`，说明用途、参数含义、使用示例
- **行内逻辑**：`//` 单行注释，说明"为什么"而非"是什么"
- **章节分隔**（可选）：`// ── 章节标题 ──────`，用于长文件内的区域划分

```typescript
/**
 * 从微信推送的原始 XML body 中提取去重键。
 *
 * - 普通消息：使用 MsgId
 * - 事件消息：用 FromUserName + CreateTime + Event 拼接
 * - 无法识别：返回空字符串，调用方应跳过去重
 */
export function extractMsgKey(body: string): string {
  // 优先使用 MsgId（比完整解析更轻量）
  const msgId = body.match(/<MsgId>(\d+)<\/MsgId>/)?.[1];
  if (msgId) return msgId;

  return [
    body.match(/<FromUserName><!\[CDATA\[(.+?)]]>/)?.[1],
    body.match(/<CreateTime>(\d+)<\/CreateTime>/)?.[1],
    body.match(/<Event><!\[CDATA\[(.+?)]]>/)?.[1],
  ]
    .filter(Boolean)
    .join('-');
}
```

---

## TypeScript 规范

- **严格模式**：`strict: true`，不允许 `any`，使用 `unknown` + 类型收窄
- **类型导入**：使用 `import type` 导入纯类型，不引入运行时依赖
- **函数返回类型**：中间件和 `async` 路由回调必须标注返回类型（`void` / `Promise<void>`）
- **可选链 + 空值合并**：优先使用 `?.` 和 `??`，避免手动 null 检查
- **类型断言**：仅在无法推断时使用 `as`，禁止强制断言绕过类型系统

```typescript
// ✅ 正确
import type { WechatReply } from '../types/wechat';
const content = msg.Content?.[0] ?? '';

// ❌ 错误
import { WechatReply } from '../types/wechat';
const content = (msg.Content as any)[0] || '';
```

---

## 添加新功能检查清单

修改或新增代码时，依次检查：

- [ ] import 无 `.js` 后缀，无 `/index`
- [ ] 所有 JSON 响应使用 `sendSuccess` / `sendFail`
- [ ] 函数名语义化，符合动词 + 名词结构
- [ ] 中间件逻辑独立文件，不内联在路由里
- [ ] 可复用逻辑提取到 `utils/` 或 `services/`
- [ ] 新路由在 `routes/index.ts` 的 `modules` 数组中注册
- [ ] 逻辑块之间有空行分隔
- [ ] 函数有必要的 JSDoc 注释
- [ ] TypeScript 类型明确，无 `any`
- [ ] `pnpm build` 无编译错误
