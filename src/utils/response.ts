import type { Response } from 'express';

/**
 * 统一成功响应结构：{ ok: true, data }
 *
 * @example
 * sendSuccess(res, { id: 1 });          // 200 { ok: true, data: { id: 1 } }
 * sendSuccess(res);                     // 200 { ok: true, data: null }
 * sendSuccess(res, undefined, 201);     // 201 { ok: true, data: null }
 */
export function sendSuccess<T = null>(res: Response, data?: T, status = 200): void {
  res.status(status).json({ ok: true, data: data ?? null });
}

/**
 * 统一失败响应结构：{ ok: false, code, message }
 *
 * @example
 * sendFail(res, 'openid 必填');           // 400 { ok: false, code: 400, message: 'openid 必填' }
 * sendFail(res, '鉴权失败', 401);         // 401 { ok: false, code: 401, message: '鉴权失败' }
 * sendFail(res, '服务不可用', 503);       // 503 { ok: false, code: 503, message: '服务不可用' }
 */
export function sendFail(res: Response, message: string, status = 400): void {
  res.status(status).json({ ok: false, code: status, message });
}
