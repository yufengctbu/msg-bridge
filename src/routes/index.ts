import { Express, Request, Response, Router } from 'express';
import { wechatRouter } from './wechat';

/** 单条路由定义 */
interface RouteDefinition {
  /** 挂载路径 */
  path: string;
  /** 对应的 Router 实例 */
  router: Router;
  /** 路由用途说明，便于阅读和排查 */
  description: string;
}

/**
 * 路由注册表 —— 所有业务路由在此集中声明。
 * 新增路由只需在此数组中添加一条记录，无需改动 app.ts。
 */
const routes: RouteDefinition[] = [
  {
    path: '/wechat',
    router: wechatRouter,
    description: '微信公众号消息接入与被动回复',
  },
];

/**
 * 将健康检查和所有业务路由注册到 Express 应用实例。
 */
export function registerRoutes(app: Express): void {
  // 健康检查：供负载均衡器 / 运维探活
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  for (const { path, router } of routes) {
    app.use(path, router);
  }
}
