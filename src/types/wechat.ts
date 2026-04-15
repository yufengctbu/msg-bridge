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

// ── 发送消息类型（Discriminated Union）──────────────────────────────────────
// 支持的类型：text / image / voice / video / news / template

/**
 * 文本回复
 * 排版建议：段落间空行、顶格书写、单条 ≤ 140 字，避免用户频繁滑动。
 */
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
 * 图文消息回复（News）— 测试号可用的最佳视觉效果
 * 卡片形式：顶部宽图（建议 900×500px）+ 加粗标题 + 灰色描述，点击跳转链接。
 * 适用场景：日报封面、新闻摘要、项目汇报推送。
 * articles：最多 8 条，第一条为封面大图（官方硬限制）。
 */
export interface NewsItem {
  title: string;
  description: string;
  /** 封面图链接，建议尺寸 900×500px，须可公网访问且直接返回图片 */
  picUrl: string;
  url: string;
}

export interface NewsReply {
  type: 'news';
  /** 至少 1 条，最多 8 条（官方限制） */
  articles: [NewsItem, ...NewsItem[]];
}

/**
 * 模板消息回复 — 结构化文本排版（仅服务号；测试号可在沙箱验证）
 * 适用于格式固定的推送：天气、打卡提醒、数据监控等。
 * 排版建议：关键字段前加 Emoji（📅 🌤 📈），段落间用 \n 分隔。
 */
export interface TemplateDataItem {
  value: string;
  color?: string;
}

export interface TemplateReply {
  type: 'template';
  templateId: string;
  /** 点击模板跳转链接，留空则不跳转 */
  url?: string;
  /** 顶部颜色，留空使用模板默认色 */
  color?: string | null;
  /** 模板数据，key 对应模板占位符（如 first / date / remark） */
  data: Record<string, TemplateDataItem>;
  /** 跳转小程序（优先级高于 url，需公众号与小程序已关联） */
  miniprogram?: { appid: string; pagepath?: string };
}

/** 所有支持发出的回复类型 */
export type WechatReply =
  | TextReply
  | ImageReply
  | VoiceReply
  | VideoReply
  | MusicReply
  | NewsReply
  | TemplateReply;
