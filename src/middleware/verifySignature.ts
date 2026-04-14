import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { config } from '../config';
import { HttpStatus } from '../utils/httpStatus';

/** 允许的时间戳偏差（秒），超过此范围视为重放攻击 */
const MAX_TIMESTAMP_AGE = 300; // 5 分钟

/**
 * 验证微信服务器签名
 * https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Access_Overview.html
 *
 * 安全措施：
 *   1. 参数完整性校验（signature / timestamp / nonce）
 *   2. timestamp 时效性校验（±5 分钟，防止重放攻击）
 *   3. 常数时间比较（crypto.timingSafeEqual，防止时序攻击）
 */
export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  const { signature, timestamp, nonce } = req.query as Record<string, string>;
  const token = config.wechat.token;

  if (!signature || !timestamp || !nonce) {
    res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    return;
  }

  // 校验 timestamp 时效性，防止截获请求后无限期重放
  const ts = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (Number.isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_AGE) {
    res.status(HttpStatus.FORBIDDEN).send('Timestamp expired');
    return;
  }

  const str = [token, timestamp, nonce].sort().join('');
  const hash = crypto.createHash('sha1').update(str).digest('hex');

  // 常数时间比较，防止时序侧信道攻击
  const hashBuf = Buffer.from(hash, 'utf8');
  const sigBuf = Buffer.from(signature, 'utf8');
  if (hashBuf.length !== sigBuf.length || !crypto.timingSafeEqual(hashBuf, sigBuf)) {
    res.status(HttpStatus.FORBIDDEN).send('Invalid signature');
    return;
  }

  next();
}
