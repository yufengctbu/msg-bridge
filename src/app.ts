import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { wechatRouter } from './routes/wechat.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Express = express();

// ── 安全 & 基础中间件 ────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// 微信服务器验证需要原始 text body
app.use(express.text({ type: 'text/xml' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 路由 ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/wechat', wechatRouter);

// ── 错误处理（必须放最后）───────────────────────────
app.use(errorHandler);

export default app;
