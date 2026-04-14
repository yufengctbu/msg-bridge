import type { Express, Request, Response, Router } from 'express';
import { wechatRouter } from './wechat';
import { sendSuccess } from '../utils/response';

/**
 * 全局 API 路由前缀 —— 修改此处即可全局生效，无需逐一修改各路由文件。
 *
 * 例：
 *   ''          → /wechat、/health
 *   '/api'      → /api/wechat、/api/health
 *   '/api/v1'   → /api/v1/wechat、/api/v1/health
 */
const API_PREFIX = '';

interface RouteModule {
  /** 相对于 API_PREFIX 的挂载路径 */
  path: string;
  router: Router;
  description: string;
}

/**
 * 路由模块注册表 —— 所有业务路由在此集中声明。
 * 新增模块只需在此数组添加一条记录，无需改动 app.ts。
 */
const modules: RouteModule[] = [
  {
    path: '/wechat',
    router: wechatRouter,
    description: '微信公众号消息接入与被动回复',
  },
];

/**
 * 将健康检查和所有业务路由注册到 Express 实例。
 * 健康检查不计入业务模块，不受 API_PREFIX 影响，固定挂载到 /health。
 */
export function registerRoutes(app: Express): void {
  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(res, { uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  for (const { path, router } of modules) {
    app.use(`${API_PREFIX}${path}`, router);
  }
}
