# 命名与代码风格参考

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 函数/变量 | camelCase | `sendMessage`, `openId` |
| 常量 | SCREAMING_SNAKE | `API_PREFIX`, `CALLBACK_TOKEN` |
| 类型/接口 | PascalCase | `WechatMessage`, `RouteModule` |
| 文件 | camelCase | `wechatApi.ts`, `callbackAuth.ts` |
| 布尔变量 | `is`/`has`/`can` 前缀 | `isValid`, `hasToken` |

## 导入顺序

```typescript
// 1. Node 内置
import { createHash } from 'crypto';
// 2. 第三方
import express from 'express';
// 3. 框架层（按 middleware → services → utils → types 顺序）
import { callbackAuth } from '../middleware/callbackAuth';
import { sendMessage } from '../services/wechatApi';
import { sendSuccess, sendFail } from '../utils/response';
import { WechatMessage } from '../types/wechat';
```

## 代码风格

```typescript
// ✅ 类型断言：用 as，不用 <>
const body = req.body as WechatMessage;

// ✅ 可选链代替 &&
const text = msg?.Content ?? '';

// ✅ early return 减少嵌套
if (!openid) return sendFail(res, 'openid 必填');
const result = await doWork(openid);
sendSuccess(res, result);

// ✅ 空行分隔逻辑块（验证→处理→响应各空一行）
const { openid, content } = req.body;
if (!openid || !content) return sendFail(res, '参数不完整');

const result = await sendMessage(openid, content);

sendSuccess(res, result);
```

## TypeScript 规则

- 禁止 `any`（使用 `unknown` + 类型守卫）
- 禁止 `!` 非空断言（用 `??` 或显式检查）
- 函数参数和返回值必须有类型，不依赖推断
