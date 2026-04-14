# 路由参考

## 路由注册表（`src/routes/index.ts`）

```typescript
export const API_PREFIX = '';   // 改这一处即全局生效，如 '/api/v1'

const modules: RouteModule[] = [
  { prefix: '/wechat', router: wechatRouter },
  // 新路由在此处追加，不在 app.ts 操作
];
```

## 路由文件模板

```typescript
// src/routes/example.ts
import { Router } from 'express';
import { someMiddleware } from '../middleware/someMiddleware';
import { someService } from '../services/someService';
import { sendSuccess, sendFail } from '../utils/response';
import { SomeType } from '../types/wechat';

const router = Router();

// 导入顺序: express → middleware → services → utils → types

router.get('/path', async (req, res) => {
  try {
    const result = await someService();
    sendSuccess(res, result);
  } catch {
    sendFail(res, '操作失败', 500);
  }
});

router.post('/path', someMiddleware, async (req, res) => {
  const { id } = req.body as SomeType;
  if (!id) return sendFail(res, 'id 必填');

  try {
    const result = await someService(id);
    sendSuccess(res, result);
  } catch {
    sendFail(res, '操作失败', 500);
  }
});

export default router;
```

## catch 块规范

- 能确认错误类型时：`catch (err) { sendFail(res, (err as Error).message, 500); }`
- 无需错误信息时：`catch { sendFail(res, '操作失败', 500); }`
- 禁止 `catch (e) { console.error(e); res.json({}) }` — 响应格式不统一
