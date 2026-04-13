# msg-bridge

微信公众号（测试号）消息接收 & 转发服务。基于 Express + TypeScript 构建，对接微信公众平台 Webhook，支持接收所有微信消息类型、被动回复、客服消息异步发送，以及消息去重。

---

## 目录

- [项目结构](#项目结构)
- [工作原理](#工作原理)
- [快速开始](#快速开始)
- [环境变量配置](#环境变量配置)
- [微信公众平台配置](#微信公众平台配置)
- [消息处理开发指南](#消息处理开发指南)
- [回复类型参考](#回复类型参考)
- [主动发送消息（客服接口）](#主动发送消息客服接口)
- [生产部署](#生产部署)

---

## 项目结构

```
src/
├── config/
│   └── index.ts          # 全局配置（统一读取环境变量）
├── middleware/
│   ├── verifySignature.ts # 微信签名验证中间件
│   └── errorHandler.ts    # 全局错误处理
├── queue/
│   └── dedupCache.ts      # MsgId 去重缓存（60s TTL）
├── routes/
│   ├── index.ts           # 路由注册表
│   └── wechat.ts          # GET 接入验证 / POST 消息接收
├── services/
│   ├── messageHandler.ts  # 消息解析与回复逻辑（主要改这里）
│   ├── replyBuilder.ts    # 被动回复 XML 序列化
│   └── wechatApi.ts       # co-wechat-api 单例（主动 API 调用）
├── types/
│   ├── wechat.ts          # 微信消息类型定义
│   └── co-wechat-api.d.ts # co-wechat-api 类型声明
├── app.ts                 # Express 应用初始化
└── index.ts               # 服务入口（启动 & 优雅关闭）
```

---

## 工作原理

```
微信用户发消息
     │
     ▼
微信服务器 ──── POST XML ────► msg-bridge（/wechat）
                                   │
                              签名验证（WECHAT_TOKEN）
                                   │
                              MsgId 去重（60s TTL）
                                   │
                              XML 解析（xml2js）
                                   │
                          resolveReply()  ← 在这里定义回复逻辑
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
         返回 XML 响应                         返回 "success"
      （被动回复，5s 内）                  + 异步调用客服接口
                │                           wechatApi.sendXxx()
                ▼                                     │
         微信服务器将 XML                      微信 API 服务器
         展示给用户                          （需 access_token）
```

**两种回复通道的区别：**

| | 被动回复 | 客服消息 |
|---|---|---|
| 时限 | 必须在 **5 秒内** 响应 | 无时限（异步） |
| access_token | 不需要 | 需要（自动管理） |
| 适用场景 | 普通即时回复 | 耗时操作（AI 调用、外部 API）、主动推送 |
| 测试号支持 | ✅ | ✅（需用户 48h 内发过消息） |

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制示例配置文件并填入实际值：

```bash
cp .env.example .env
```

### 3. 暴露本地服务（开发阶段）

微信服务器需要能访问到你的服务，本地开发可使用内网穿透工具：

```bash
# 使用 ngrok（任选其一）
ngrok http 3000

# 或使用 cloudflared
cloudflared tunnel --url http://localhost:3000
```

记录生成的公网 URL，如 `https://xxxx.ngrok-free.app`。

### 4. 启动开发服务

```bash
pnpm dev
```

### 5. 在微信公众平台完成接入配置

参见下方 [微信公众平台配置](#微信公众平台配置) 章节。

### 6. 构建生产版本

```bash
pnpm build     # 输出到 dist/
pnpm start     # 运行编译产物
```

---

## 环境变量配置

在项目根目录创建 `.env` 文件：

```dotenv
# ── 服务器 ─────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development     # production | development

# ── 微信公众号（测试号）─────────────────────────────────────────
# 在 https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login 查看

# 接入验证 Token（自定义字符串，与公众平台填写的 Token 保持一致）
WECHAT_TOKEN=your_token_here

# 用于主动 API 调用（客服消息、用户管理等）
WECHAT_APP_ID=your_appid_here
WECHAT_APP_SECRET=your_appsecret_here

# ── 消息转发目标（可选）────────────────────────────────────────
FORWARD_URL=https://your-backend.com/webhook
```

| 变量名 | 必填 | 说明 |
|---|---|---|
| `PORT` | 否 | 监听端口，默认 `3000` |
| `NODE_ENV` | 否 | 环境标识，`production` 时错误不返回堆栈 |
| `WECHAT_TOKEN` | **是** | **由你自定义的任意字符串**（非平台提供），需与测试号后台「接口配置信息」中填写的 Token 保持一致 |
| `WECHAT_APP_ID` | **是** | 测试号的 `appID`（平台提供，在测试号管理页面顶部查看） |
| `WECHAT_APP_SECRET` | **是** | 测试号的 `appsecret`（平台提供，在测试号管理页面顶部查看） |
| `FORWARD_URL` | 否 | 消息转发目标 URL（如需二次转发） |

> **注意**：`WECHAT_TOKEN` 不是微信平台颁发的，是你自己随意定义的字符串（如 `my_bridge_2026`），然后在 `.env` 和测试号后台两边填入同一个值即可。它与 `access_token`（通过 appId+appSecret 向微信服务器请求获得）是完全不同的概念。

---

## 微信公众平台配置

### 测试号管理页面

访问：https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login

### 接口配置

在「接口配置信息」处填写：

| 字段 | 值 |
|---|---|
| URL | `https://你的公网域名/wechat`（路由固定为 `/wechat`） |
| Token | **你自定义的任意字符串**，与 `.env` 中 `WECHAT_TOKEN` 完全一致 |

**URL 填写示例：**

| 场景 | URL 示例 |
|---|---|
| 本地开发（ngrok） | `https://abc123.ngrok-free.app/wechat` |
| 本地开发（cloudflared） | `https://xxx.trycloudflare.com/wechat` |
| 生产部署 | `https://api.example.com/wechat` |

> **重要**：微信要求 URL 只能使用 `http://`（80 端口）或 `https://`（443 端口），**不支持自定义端口号**。如果服务运行在 3000 等其他端口，需要通过 Nginx 等反向代理将 80/443 的流量转发到实际端口。

填写后点击「提交」，微信服务器会向 URL 发送 GET 请求验证签名，验证通过即接入成功。

### 消息接收

接入成功后，用户向测试号发送的所有消息会以 POST 方式推送到你的 URL。

---

## 消息处理开发指南

所有消息处理逻辑集中在 `src/services/messageHandler.ts` 的 `resolveReply()` 函数中。添加新的处理逻辑只需在对应 `case` 中修改，无需改动其他文件。

### 接收到的消息类型

| MsgType | 说明 | 关键字段 |
|---|---|---|
| `text` | 文本消息 | `msg.Content?.[0]` |
| `image` | 图片消息 | `msg.MediaId?.[0]`、`msg.PicUrl?.[0]` |
| `voice` | 语音消息 | `msg.MediaId?.[0]`、`msg.Format?.[0]` |
| `video` | 视频消息 | `msg.MediaId?.[0]`、`msg.ThumbMediaId?.[0]` |
| `shortvideo` | 小视频 | `msg.MediaId?.[0]` |
| `location` | 地理位置 | `msg.Location_X?.[0]`（纬）、`msg.Location_Y?.[0]`（经）、`msg.Label?.[0]` |
| `link` | 链接消息 | `msg.Title?.[0]`、`msg.Url?.[0]`、`msg.Description?.[0]` |
| `event` | 事件消息 | `msg.Event?.[0]`（subscribe / unsubscribe / CLICK / VIEW 等） |

### 示例：修改文本消息回复逻辑

```typescript
// src/services/messageHandler.ts → resolveReply()

case 'text': {
  const content = msg.Content?.[0] ?? '';

  // 示例：关键字触发不同回复
  if (content === '帮助') {
    return {
      type: 'markdown',
      content: `## 使用指南\n- 发送任意文字 → 原文回显\n- 发送 \`/md 内容\` → Markdown 格式化`,
    };
  }

  // 默认：原文回显
  return { type: 'text', content };
}
```

### 示例：用户关注时回复欢迎语

```typescript
case 'event': {
  const event = msg.Event?.[0] ?? '';

  if (event === 'subscribe') {
    return {
      type: 'markdown',
      content: `## 欢迎关注！\n\n我是 **msg-bridge** 消息助手。\n\n发送任意消息开始体验。`,
    };
  }

  return null; // 其他事件不回复
}
```

### 示例：发送图片回复

收到图片后，将同一张图回传给用户：

```typescript
case 'image': {
  const mediaId = msg.MediaId?.[0] ?? '';
  return { type: 'image', mediaId };
}
```

### 示例：超过 5s 的耗时操作（异步客服消息）

```typescript
import { sendCustomerServiceMessage } from './messageHandler.js';

case 'text': {
  const openid = msg.FromUserName?.[0] ?? '';
  const content = msg.Content?.[0] ?? '';

  // 立即返回"正在处理"，避免超时
  // 异步执行耗时操作后再通过客服接口回复
  void callExternalAI(content).then((result) => {
    sendCustomerServiceMessage(openid, { type: 'text', content: result });
  });

  return { type: 'text', content: '正在处理，请稍候...' };
}
```

---

## 回复类型参考

`resolveReply()` 返回的对象决定回复类型，支持以下格式：

### 文本

```typescript
return { type: 'text', content: '你好！' };
```

### Markdown（自动转换为带格式的纯文本）

```typescript
return {
  type: 'markdown',
  content: `## 标题\n\n- 列表项 1\n- 列表项 2\n\n**粗体内容**`,
};
```

发出效果（Unicode 装饰格式化）：

```
▌ 标题
──────────────────
• 列表项 1
• 列表项 2

「粗体内容」
```

### 代码块

```typescript
return {
  type: 'code',
  language: 'typescript',
  code: 'const greet = (name: string) => `Hello, ${name}!`;',
};
```

### 图片

```typescript
// mediaId 通过 wechatApi.uploadMedia() 上传素材后获得
return { type: 'image', mediaId: 'MEDIA_ID' };
```

### 语音

```typescript
return { type: 'voice', mediaId: 'MEDIA_ID' };
```

### 视频

```typescript
return {
  type: 'video',
  mediaId: 'VIDEO_MEDIA_ID',
  thumbMediaId: 'THUMB_MEDIA_ID', // 缩略图，必填
  title: '视频标题',               // 可选
  description: '视频描述',         // 可选
};
```

### 音乐

```typescript
return {
  type: 'music',
  thumbMediaId: 'THUMB_MEDIA_ID',  // 缩略图，必填
  title: '歌曲名',
  description: '演唱者',
  musicUrl: 'https://example.com/song.mp3',
  hqMusicUrl: 'https://example.com/song-hq.mp3', // Wi-Fi 下播放
};
```

### 图文消息

```typescript
return {
  type: 'news',
  articles: [
    {
      title: '文章标题',
      description: '文章摘要',
      picUrl: 'https://example.com/cover.jpg',
      url: 'https://example.com/article/1',
    },
    // 最多 8 条
  ],
};
```

### 不回复

```typescript
return null; // 微信服务器收到空响应，不展示任何内容
```

---

## 主动发送消息（客服接口）

适用于：耗时操作完成后回调、不在被动回复时限内的主动推送。

> ⚠️ 测试号限制：用户必须在 **48 小时内**主动向公众号发过消息，才能收到客服消息。

```typescript
import { wechatApi } from './services/wechatApi.js';

// 发送文本
await wechatApi.sendText(openid, '处理完成！');

// 发送图片
await wechatApi.sendImage(openid, 'MEDIA_ID');

// 发送图文
await wechatApi.sendNews(openid, [
  {
    title: '标题',
    description: '描述',
    url: 'https://example.com',
    picurl: 'https://example.com/img.jpg',
  },
]);

// 发送小程序卡片
await wechatApi.sendMiniProgram(openid, {
  title: '小程序标题',
  appid: 'wx123456',
  pagepath: 'pages/index/index',
  thumb_media_id: 'THUMB_MEDIA_ID',
});
```

`wechatApi` 上的完整方法列表见 `src/types/co-wechat-api.d.ts`，access_token 自动管理，无需手动处理。

### 上传素材

媒体文件（图片、语音、视频）需先上传获取 `media_id`，有效期 3 天：

```typescript
const result = await wechatApi.uploadMedia('/path/to/image.jpg', 'image');
console.log(result.media_id); // 使用此 ID 发送消息
```

---

## 生产部署

### 环境变量

```dotenv
NODE_ENV=production
PORT=3000
WECHAT_TOKEN=...
WECHAT_APP_ID=...
WECHAT_APP_SECRET=...
```

### 构建并启动

```bash
pnpm build
pnpm start
```

### 多进程部署（集群模式）

默认使用内存存储 access_token。**多实例部署时**需持久化 token 到 Redis，否则多进程之间会频繁刷新 token 导致互相失效：

```typescript
// src/services/wechatApi.ts
import WechatAPI from 'co-wechat-api';
import { redis } from './redis.js'; // 你的 Redis 客户端

const KEY = 'wechat:access_token';

export const wechatApi = new WechatAPI(
  config.wechat.appId,
  config.wechat.appSecret,
  async () => {
    const raw = await redis.get(KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async (token) => {
    await redis.set(KEY, JSON.stringify(token), 'EX', 7000);
  },
);
```

### 优雅关闭

服务已内置 `SIGTERM` / `SIGINT` 处理，收到信号后：
1. 停止接受新连接
2. 等待当前请求处理完毕（最多 10 秒）
3. 强制退出

配合 PM2 / Docker：

```bash
# PM2
pm2 start dist/index.js --name msg-bridge

# Docker（支持 SIGTERM）
CMD ["node", "dist/index.js"]
```

---

## 技术栈

| 库 | 用途 |
|---|---|
| Express 5 | HTTP 服务框架 |
| TypeScript | 类型安全 |
| co-wechat-api | 微信主动 API 调用（access_token 自动管理） |
| xml2js | 解析微信推送的 XML 消息 |
| helmet | HTTP 安全响应头 |
| cors | 跨域配置 |
| morgan | HTTP 访问日志 |
| dotenv | 环境变量加载 |
