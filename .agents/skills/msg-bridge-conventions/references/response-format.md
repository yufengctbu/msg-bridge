# 响应格式参考

## API 签名

```typescript
// src/utils/response.ts
sendSuccess<T>(res: Response, data?: T, status?: number): void
sendFail(res: Response, message: string, status?: number): void
```

## 成功响应 → `{ ok: true, data: T | null }`

```typescript
import { sendSuccess } from '../utils/response';

sendSuccess(res);                      // 200 { ok: true, data: null }
sendSuccess(res, { openid: 'oXxx' }); // 200 { ok: true, data: { openid: 'oXxx' } }
sendSuccess(res, { id: 1 }, 201);     // 201 { ok: true, data: { id: 1 } }
```

## 失败响应 → `{ ok: false, code: number, message: string }`

```typescript
import { sendFail } from '../utils/response';

sendFail(res, 'openid 必填');          // 400 { ok: false, code: 400, message: 'openid 必填' }
sendFail(res, '鉴权失败', 401);        // 401 { ok: false, code: 401, message: '鉴权失败' }
sendFail(res, 'CALLBACK_TOKEN 未配置，此端点不可用', 503);
```

## 禁止的写法

```typescript
res.json({ ok: true });                  // ❌ 裸调用
res.status(400).json({ error: '...' }); // ❌ 自定义结构
res.json({ code: 0, msg: 'ok' });       // ❌ 非标准字段名
```
