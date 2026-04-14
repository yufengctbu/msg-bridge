# 中间件参考

## 中间件模板

```typescript
// src/middleware/exampleAuth.ts
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { sendFail } from '../utils/response';

export function exampleAuth(req: Request, res: Response, next: NextFunction): void {
  const { token } = config.someSection;
  if (!token) {
    sendFail(res, 'TOKEN 未配置，此端点不可用', 503);
    return;
  }
  const provided = req.headers['x-some-token'] as string | undefined;
  if (provided !== token) {
    sendFail(res, '鉴权失败', 401);
    return;
  }
  next();
}
```

## 规范要点

| 规范 | 说明 |
|------|------|
| 返回类型 | 必须声明 `: void` |
| 验证失败 | 用 `sendFail` + `return`，禁止 `return sendFail(...)` |
| 配置缺失 | 返回 `503`（服务不可用），不使用 `500` |
| 位置 | 所有中间件放 `src/middleware/`，不在路由文件内定义 |

## 在路由中使用

```typescript
// 路由级中间件：作为路由参数
router.post('/send', exampleAuth, async (req, res) => { ... });

// 应用级中间件：在 src/app.ts 注册
app.use(express.json());
app.use(verifySignature);
```
