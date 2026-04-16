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
- [消息转发与回复机制](#消息转发与回复机制)
- [主动发送消息（客服接口）](#主动发送消息客服接口)
- [素材上传](#素材上传)
- [生产部署](#生产部署)

---

## 项目结构

```
src/
├── config/
│   └── index.ts          # 全局配置（统一读取环境变量）
├── middleware/
│   ├── verifySignature.ts # 微信签名验证中间件
│   ├── callbackAuth.ts    # /wechat/send 及 /wechat/upload 鉴权
│   └── errorHandler.ts    # 全局错误处理
├── queue/
│   └── dedupCache.ts      # MsgId 去重缓存（60s TTL）
├── routes/
│   ├── index.ts           # 路由注册表
│   └── wechat.ts          # GET 接入验证 / POST 消息接收
├── services/
│   ├── messageHandler.ts  # 消息解析与回复逻辑（主要改这里）
│   ├── mediaService.ts    # 素材上传（uploadTempMedia）
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
# 其他后端调用 /wechat/send 时需在 X-Callback-Token 请求头携带此值
CALLBACK_TOKEN=your_callback_token_here
```

| 变量名 | 必填 | 说明 |
|---|---|---|
| `PORT` | 否 | 监听端口，默认 `3000` |
| `NODE_ENV` | 否 | 环境标识，`production` 时错误不返回堆栈 |
| `WECHAT_TOKEN` | **是** | **由你自定义的任意字符串**（非平台提供），需与测试号后台「接口配置信息」中填写的 Token 保持一致 |
| `WECHAT_APP_ID` | **是** | 测试号的 `appID`（平台提供，在测试号管理页面顶部查看） |
| `WECHAT_APP_SECRET` | **是** | 测试号的 `appsecret`（平台提供，在测试号管理页面顶部查看） |
| `FORWARD_URL` | 否 | 消息转发目标 URL（如需二次转发） |
| `CALLBACK_TOKEN` | 否 | 其他后端调用 `/wechat/send` 时的鉴权令牌（与 `FORWARD_URL` 配合使用） |

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
      type: 'text',
      content: `使用指南\n\n- 发送任意文字 → 原文回显\n- 发送 /help → 查看此帮助`,
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
      type: 'text',
      content: `欢迎关注！\n\n我是 msg-bridge 消息助手。\n\n发送任意消息开始体验。`,
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

支持通过 `resolveReply()`（被动回复）或 `POST /wechat/send`（主动推送）发送以下类型。

> **测试号可用性说明**
> - `text` / `image` / `voice` / `video` / `music` / `news` — 测试号全部可用
> - `template` — 测试号需在管理页单独申请测试模板（无需认证）

---

### 文本（text）

极简排版原则：顶格书写、段落间空一行、单条 ≤ 140 字。

```typescript
return { type: 'text', content: '📅 今日日报\n\n天气：晴转多云\n气温：20°C ~ 28°C\n\n💡 适合户外活动，注意防晒。' };
```

```json
{ "openid": "oBabc123456", "type": "text", "content": "📅 今日日报\n\n天气：晴转多云\n\n💡 注意防晒。" }
```

---

### 图文消息（news）— 测试号最佳视觉效果

卡片形式：顶部宽图 + 加粗标题 + 灰色描述，点击跳转链接。
适用场景：日报封面、新闻摘要、项目汇报推送。

> 图片建议尺寸 **900×500px**，`picUrl` 须可公网访问且直接返回图片文件。

```typescript
return {
  type: 'news',
  articles: [
    {
      title: '操作指南',
      description: '发送 help 获取帮助，发送 status 查看状态',
      picUrl: 'https://fastly.picsum.photos/id/137/400/200.jpg?hmac=7GOEmQEJNznawKi8mMjA3tPrgb6kbZZ0qCxn8H0RKFU',
      url: 'https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html',
    },
    // 最多 8 条，第一条为封面大图
  ],
};
```

```json
{
  "openid": "oBabc123456",
  "type": "news",
  "articles": [{
    "title": "操作指南",
    "description": "发送 help 获取帮助，发送 status 查看状态",
    "picUrl": "https://fastly.picsum.photos/id/137/400/200.jpg?hmac=7GOEmQEJNznawKi8mMjA3tPrgb6kbZZ0qCxn8H0RKFU",
    "url": "https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html"
  }]
}
```

---

### 模板消息（template）— 结构化排版

适合格式固定的推送：天气、打卡提醒、数据监控。
关键数据前加 Emoji（📅 🌤 📈），段落间用 `\n` 分隔，阅读体验更佳。

**第一步：在测试号管理页申请模板**

1. 访问 [测试号管理页](https://mp.weixin.qq.com/debug/cgi-bin/sandboxinfo)
2. 下拉找到「模板消息接口」→「新增测试模板」
3. 填写模板内容（`{{key.DATA}}` 为占位符），提交后获得 `templateId`

示例模板内容：
```
{{first.DATA}}
📅 日期：{{date.DATA}}
🌤 天气：{{weather.DATA}}
💡 寄语：{{remark.DATA}}
```

**第二步：发送请求**

```typescript
return {
  type: 'template',
  templateId: 'your_template_id_here',
  url: 'https://example.com',   // 点击跳转链接，留空则不跳转
  color: null,                  // 顶部颜色，null 使用模板默认色
  data: {
    first:   { value: '📅 今日天气播报', color: '#173177' },
    date:    { value: '2026-04-15' },
    weather: { value: '厦门 晴转多云' },
    remark:  { value: '适合户外活动，注意防晒。', color: '#999999' },
  },
};
```

```json
{
  "openid": "oBabc123456",
  "type": "template",
  "templateId": "your_template_id_here",
  "url": "https://example.com",
  "color": null,
  "data": {
    "first":   { "value": "📅 今日天气播报", "color": "#173177" },
    "date":    { "value": "2026-04-15" },
    "weather": { "value": "厦门 晴转多云" },
    "remark":  { "value": "适合户外活动，注意防晒。", "color": "#999999" }
  }
}
```

微信端效果：
```
📅 今日天气播报
─────────────────
📅 日期：2026-04-15
🌤 天气：厦门 晴转多云
💡 寄语：适合户外活动，注意防晒。
```

> `data` 的 key 必须与模板占位符完全对应；`miniprogram` 字段可选，填写后点击跳转小程序（优先级高于 `url`）。

---

### 图片（image）

```typescript
// mediaId 通过 POST /wechat/upload 上传后获得（有效期 3 天）
return { type: 'image', mediaId: 'MEDIA_ID' };
```

```json
{ "openid": "oBabc123456", "type": "image", "mediaId": "MEDIA_ID" }
```

---

### 语音（voice）

```typescript
return { type: 'voice', mediaId: 'MEDIA_ID' };
```

```json
{ "openid": "oBabc123456", "type": "voice", "mediaId": "MEDIA_ID" }
```

---

### 视频（video）

```typescript
return {
  type: 'video',
  mediaId: 'VIDEO_MEDIA_ID',
  thumbMediaId: 'THUMB_MEDIA_ID', // 缩略图，必填
  title: '视频标题',               // 可选
  description: '视频描述',         // 可选
};
```

```json
{ "openid": "oBabc123456", "type": "video", "mediaId": "VIDEO_MEDIA_ID", "thumbMediaId": "THUMB_MEDIA_ID", "title": "视频标题" }
```

---

### 音乐（music）

```typescript
return {
  type: 'music',
  thumbMediaId: 'THUMB_MEDIA_ID',                   // 缩略图，必填
  title: '光辉岁月',
  description: 'Beyond',
  musicUrl: 'https://example.com/song.mp3',
  hqMusicUrl: 'https://example.com/song-hq.mp3',   // Wi-Fi 下优先播放
};
```

```json
{ "openid": "oBabc123456", "type": "music", "thumbMediaId": "THUMB_MEDIA_ID", "title": "光辉岁月", "musicUrl": "https://example.com/song.mp3" }
```

---

### 不回复

```typescript
return null; // 微信服务器收到空响应，不展示任何内容
```

---

### 批量发送

`POST /wechat/send` 的 `openid` 字段支持字符串数组，所有类型均可批量发送：

```json
{
  "openid": ["oBabc111", "oBabc222", "oBabc333"],
  "type": "text",
  "content": "群发通知内容"
}
```

响应中包含每个 openid 的发送结果：

```json
{
  "code": 0,
  "results": [
    { "openid": "oBabc111", "ok": true },
    { "openid": "oBabc222", "ok": false, "error": "用户未关注" }
  ]
}
```

---

## 消息转发与回复机制

配置 `FORWARD_URL` 后，msg-bridge 将进入**桥接模式**：收到微信消息后不再走内置的 `resolveReply()`，而是把消息 POST 给你的后端，由后端决定如何回复。

### 整体流程

```
微信用户发消息
      │
      ▼
 msg-bridge
      │  POST JSON（消息内容）
      ▼
 your-backend.com/webhook
      │
      ├─ 快速处理（< 4s）→ 响应 JSON 回复 ──► msg-bridge ──► 被动 XML 回复微信
      │
      └─ 慢速处理（> 4s）→ 响应 null/空    ──► msg-bridge 返回 success
                               │
                               ▼ 异步完成后
                  POST /wechat/send（带 X-Callback-Token）
                               │
                               ▼
                     msg-bridge 调用客服 API 回复用户
```

### 转发请求格式（msg-bridge → 你的后端）

```http
POST https://your-backend.com/webhook
Content-Type: application/json

{
  "FromUserName": "用户 OpenID",
  "ToUserName":   "公众号 gh_xxx",
  "MsgType":      "text",
  "MsgId":        "123456789",
  "CreateTime":   "1713100000",
  "Content":      "你好"
}
```

字段与微信推送的 XML 一一对应（已展平为字符串，不含数组包装）。

### 方式一：同步回复（≤ 4s）

你的后端在 4 秒内响应 JSON，msg-bridge 将其转为被动 XML 回复给用户：

```json
{ "type": "text", "content": "你好！" }
```

不需要回复时响应 `null` 或空 body：

```json
null
```

支持的 `type` 与 [回复类型参考](#回复类型参考) 一致。

### 方式二：异步回复（无时限）

当处理时间超过 4s（如调用 AI、查数据库），先响应 `null`，处理完成后调用：

```http
POST https://msg-bridge地址/wechat/send
X-Callback-Token: your_callback_token_here
Content-Type: application/json

{
  "openid": "用户 OpenID（即 FromUserName）",
  "type":   "text",
  "content": "处理完成，结果是…"
}
```

- `X-Callback-Token` 值必须与 `.env` 中的 `CALLBACK_TOKEN` 一致。
- 未配置 `CALLBACK_TOKEN` 时，`/wechat/send` 端点返回 503，不可用。
- 底层使用客服消息接口，需要用户 48h 内向公众号发过消息。

**完整示例（你的后端 Node.js）：**

```typescript
import express from 'express';
const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const msg = req.body;

  if (msg.MsgType === 'text' && msg.Content === '今天天气') {
    // 快速回复：直接响应
    return res.json({ type: 'text', content: '正在查询，请稍候…' });
  }

  if (msg.MsgType === 'text') {
    // 慢操作：先响应 null，异步完成后回调
    res.json(null);

    const result = await callAI(msg.Content);
    await fetch('https://msg-bridge地址/wechat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Callback-Token': process.env.CALLBACK_TOKEN,
      },
      body: JSON.stringify({
        openid: msg.FromUserName,
        type: 'text',
        content: result,
      }),
    });
    return;
  }

  // 其他消息类型不回复
  res.json(null);
});
```

---

## 主动发送消息（客服接口）

适用于：耗时操作完成后回调、不在被动回复时限内的主动推送。

> ⚠️ 测试号限制：用户必须在 **48 小时内**主动向公众号发过消息，才能收到客服消息。

### 通过 HTTP 接口发送

推荐外部服务使用 `POST /wechat/send` 发送，类型与 [回复类型参考](#回复类型参考) 完全一致：

```http
POST /wechat/send
X-Callback-Token: your_callback_token_here
Content-Type: application/json

{
  "openid": "oBabc123456",
  "type": "text",
  "content": "处理完成！"
}
```

### 通过代码直接调用

```typescript
import { wechatApi } from './services/wechatApi.js';

// 发送文本
await wechatApi.sendText(openid, '处理完成！');

// 发送图文
await wechatApi.sendNews(openid, [{
  title: '标题',
  description: '描述',
  url: 'https://example.com',
  picurl: 'https://example.com/img.jpg',
}]);

// 发送模板消息
await wechatApi.sendTemplate(openid, 'templateId', 'https://example.com', null, {
  first:   { value: '📅 今日天气播报', color: '#173177' },
  date:    { value: '2026-04-15' },
  weather: { value: '厦门 晴转多云' },
  remark:  { value: '适合户外活动，注意防晒。', color: '#999999' },
});
```

`wechatApi` 上的完整方法列表见 `src/types/co-wechat-api.d.ts`，access_token 自动管理，无需手动处理。

---

## 素材上传

媒体文件（图片、语音、视频）需先上传到微信获取 `mediaId`，有效期 **3 天**，可直接用于 `/wechat/send`。

> ⚠️ 仅限临时素材。永久素材请使用微信公众平台后台上传。

### 通过 HTTP 接口上传（推荐）

```http
POST /wechat/upload
X-Callback-Token: your_callback_token_here
Content-Type: multipart/form-data

file=<文件>        # 必填，字段名为 file
type=image         # 可选：image（默认）/ voice / video / thumb
```

**curl 示例：**

```bash
curl -X POST https://msg-bridge地址/wechat/upload \
  -H "X-Callback-Token: your_callback_token_here" \
  -F "file=@/path/to/image.jpg" \
  -F "type=image"
```

**响应：**

```json
{ "code": 0, "data": { "mediaId": "xxxxxxx", "type": "image" } }
```

**再用 mediaId 发送图片：**

```bash
curl -X POST https://msg-bridge地址/wechat/send \
  -H "X-Callback-Token: your_callback_token_here" \
  -H "Content-Type: application/json" \
  -d '{ "openid": "oBabc123456", "type": "image", "mediaId": "上一步获得的ID" }'
```

### 通过代码直接调用

```typescript
import { uploadTempMedia } from './services/mediaService.js';

const mediaId = await uploadTempMedia('/path/to/image.jpg', 'image');
await wechatApi.sendImage(openid, mediaId);
```

| 参数 `type` | 说明 | 格式要求 |
|---|---|---|
| `image` | 图片 | JPG / PNG，≤ 10 MB |
| `voice` | 语音 | AMR / MP3，≤ 2 MB，时长 ≤ 60s |
| `video` | 视频 | MP4，≤ 10 MB |
| `thumb` | 缩略图（音乐/视频封面） | JPG，≤ 64 KB |

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
| multer | 处理 multipart/form-data 文件上传 |
| helmet | HTTP 安全响应头 |
| cors | 跨域配置 |
| morgan | HTTP 访问日志 |
| dotenv | 环境变量加载 |
