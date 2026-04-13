import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Express = express();

// ── 安全 & 基础中间件 ────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan(config.server.env === 'production' ? 'combined' : 'dev'));

// 微信服务器验证需要原始 text body；显式限制体积防止大 payload 攻击
app.use(express.text({ type: 'text/xml', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── 路由（通过注册表统一挂载）───────────────────────
registerRoutes(app);

// ── 错误处理（必须放最后）───────────────────────────
app.use(errorHandler);

export default app;
