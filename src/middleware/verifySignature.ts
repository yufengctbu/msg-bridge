import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

/**
 * 验证微信服务器签名
 * https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Access_Overview.html
 */
export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  const { signature, timestamp, nonce } = req.query as Record<string, string>;
  const token = process.env.WECHAT_TOKEN ?? '';

  if (!signature || !timestamp || !nonce) {
    res.status(403).send('Forbidden');
    return;
  }

  const str = [token, timestamp, nonce].sort().join('');
  const hash = crypto.createHash('sha1').update(str).digest('hex');

  if (hash !== signature) {
    res.status(403).send('Invalid signature');
    return;
  }

  next();
}
