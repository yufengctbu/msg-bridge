/**
 * 微信服务器推送过来的原始消息结构（xml2js 解析后的字段均为 string[]）。
 * 字段按官方文档分类注释，便于查阅。
 *
 * 官方文档：https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Passive_user_reply_message.html
 */
export interface WechatIncomingMessage {
  // ── 公共字段 ────────────────────────────────────────────────────────────
  ToUserName?: string[]; // 开发者微信号
  FromUserName?: string[]; // 发送方 OpenID
  CreateTime?: string[]; // 消息创建时间（Unix 时间戳）
  MsgType?: string[]; // 消息类型
  MsgId?: string[]; // 消息 ID（64 位整型，事件消息无此字段）

  // ── text ────────────────────────────────────────────────────────────────
  Content?: string[]; // 文本内容

  // ── image ───────────────────────────────────────────────────────────────
  PicUrl?: string[]; // 图片链接（CDN）
  MediaId?: string[]; // 媒体 ID（图片/语音/视频通用）

  // ── voice ───────────────────────────────────────────────────────────────
  Format?: string[]; // 语音格式：amr / speex
  MediaId16K?: string[]; // 16K 采样率语音媒体 ID

  // ── video / shortvideo ──────────────────────────────────────────────────
  ThumbMediaId?: string[]; // 视频缩略图媒体 ID

  // ── location ────────────────────────────────────────────────────────────
  Location_X?: string[]; // 纬度
  Location_Y?: string[]; // 经度
  Scale?: string[]; // 地图缩放级别
  Label?: string[]; // 地理位置描述

  // ── link ────────────────────────────────────────────────────────────────
  Title?: string[]; // 链接标题
  Description?: string[]; // 链接描述
  Url?: string[]; // 链接地址

  // ── event ───────────────────────────────────────────────────────────────
  Event?: string[]; // 事件类型：subscribe / unsubscribe / CLICK / VIEW 等
  EventKey?: string[]; // 事件 KEY（菜单 CLICK / VIEW 带此字段）
}

// ── 被动回复消息类型（Discriminated Union）─────────────────────────────────
// 官方文档：https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Passive_user_reply_message.html
//
// 支持的被动回复类型：text / image / voice / video / music / news
// markdown 和 code 为本项目扩展类型，最终以 text 格式发出。

/** 文本回复 */
export interface TextReply {
  type: 'text';
  content: string;
}

/**
 * 图片回复
 * mediaId：通过素材管理接口上传后获取，支持临时素材和永久素材。
 * 上传接口：POST https://api.weixin.qq.com/cgi-bin/media/upload
 */
export interface ImageReply {
  type: 'image';
  mediaId: string;
}

/**
 * 语音回复
 * mediaId：通过素材管理接口上传的语音素材 ID（格式：amr / speex）。
 */
export interface VoiceReply {
  type: 'voice';
  mediaId: string;
}

/**
 * 视频回复
 * mediaId：视频素材 ID；thumbMediaId：缩略图素材 ID（必填）。
 * title / description 为展示用，可选。
 */
export interface VideoReply {
  type: 'video';
  mediaId: string;
  thumbMediaId: string;
  title?: string;
  description?: string;
}

/**
 * 音乐回复
 * thumbMediaId：缩略图媒体 ID（必填，其余可选）。
 * hqMusicUrl：Wi-Fi 下优先播放的高质量音乐链接，缺省时与 musicUrl 相同。
 */
export interface MusicReply {
  type: 'music';
  thumbMediaId: string;
  title?: string;
  description?: string;
  musicUrl?: string;
  hqMusicUrl?: string;
}

/**
 * 图文消息回复
 * articles：最多 8 条，第一条为封面大图（官方硬限制）。
 */
export interface NewsItem {
  title: string;
  description: string;
  picUrl: string;
  url: string;
}

export interface NewsReply {
  type: 'news';
  /** 至少 1 条，最多 8 条（官方限制） */
  articles: [NewsItem, ...NewsItem[]];
}

/**
 * Markdown 回复（本项目扩展）
 * 微信被动回复不渲染 Markdown，此处通过 Unicode 装饰字符格式化为可读纯文本后以 text 发出。
 */
export interface MarkdownReply {
  type: 'markdown';
  content: string;
}

/**
 * 代码块回复（本项目扩展）
 * 以带边框的纯文本格式发出，保留缩进和换行结构。
 */
export interface CodeReply {
  type: 'code';
  language: string;
  code: string;
}

/** 所有支持发出的回复类型 */
export type WechatReply =
  | TextReply
  | ImageReply
  | VoiceReply
  | VideoReply
  | MusicReply
  | NewsReply
  | MarkdownReply
  | CodeReply;
