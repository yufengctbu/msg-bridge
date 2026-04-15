import type { NewsItem, VideoReply, MusicReply, WechatReply } from '../types/wechat';

/**
 * 转义 CDATA 终止序列 `]]>`，防止用户内容注入 XML。
 * `]]>` → `]]]]><![CDATA[>`（合法的 CDATA 拼接写法）
 */
function escapeCdata(str: string): string {
  return str.replace(/]]>/g, ']]]]><![CDATA[>');
}

/**
 * 将 WechatReply 对象序列化为微信被动回复 XML 字符串。
 * 每种消息类型对应独立的 builder 函数，便于单独测试。
 *
 * XML 字段顺序严格遵照官方文档：
 * ToUserName → FromUserName → CreateTime → MsgType → 消息体
 */
export function buildReplyXml(from: string, to: string, reply: WechatReply): string {
  switch (reply.type) {
    case 'text':
      return buildTextXml(from, to, reply.content);
    case 'image':
      return buildImageXml(from, to, reply.mediaId);
    case 'voice':
      return buildVoiceXml(from, to, reply.mediaId);
    case 'video':
      return buildVideoXml(from, to, reply);
    case 'music':
      return buildMusicXml(from, to, reply);
    case 'news':
      return buildNewsXml(from, to, reply.articles);
    case 'template':
      // 模板消息通过客服接口发送，不走被动回复 XML
      return 'success';
  }
}

// ── 各类型 XML builder ───────────────────────────────────────────────────────
// 字段结构与 XML 格式严格对齐官方被动回复文档
// https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Passive_user_reply_message.html

/** 回复文本消息 */
function buildTextXml(from: string, to: string, content: string): string {
  return wrapXml(from, to, 'text', `<Content><![CDATA[${escapeCdata(content)}]]></Content>`);
}

/**
 * 回复图片消息
 * 官方格式：<Image><MediaId><![CDATA[media_id]]></MediaId></Image>
 */
function buildImageXml(from: string, to: string, mediaId: string): string {
  return wrapXml(
    from,
    to,
    'image',
    `<Image><MediaId><![CDATA[${escapeCdata(mediaId)}]]></MediaId></Image>`,
  );
}

/**
 * 回复语音消息
 * 官方格式：<Voice><MediaId><![CDATA[media_id]]></MediaId></Voice>
 */
function buildVoiceXml(from: string, to: string, mediaId: string): string {
  return wrapXml(
    from,
    to,
    'voice',
    `<Voice><MediaId><![CDATA[${escapeCdata(mediaId)}]]></MediaId></Voice>`,
  );
}

/**
 * 回复视频消息
 * 官方格式：<Video><MediaId> + <ThumbMediaId> + 可选 <Title> <Description>
 */
function buildVideoXml(from: string, to: string, reply: VideoReply): string {
  return wrapXml(
    from,
    to,
    'video',
    `<Video>
    <MediaId><![CDATA[${escapeCdata(reply.mediaId)}]]></MediaId>
    <ThumbMediaId><![CDATA[${escapeCdata(reply.thumbMediaId)}]]></ThumbMediaId>
    <Title><![CDATA[${escapeCdata(reply.title ?? '')}]]></Title>
    <Description><![CDATA[${escapeCdata(reply.description ?? '')}]]></Description>
  </Video>`,
  );
}

/**
 * 回复音乐消息
 * 官方格式：<Music><Title><Description><MusicUrl><HQMusicUrl><ThumbMediaId>
 * HQMusicUrl：Wi-Fi 下优先播放，缺省时与 MusicUrl 相同。
 */
function buildMusicXml(from: string, to: string, reply: MusicReply): string {
  return wrapXml(
    from,
    to,
    'music',
    `<Music>
    <Title><![CDATA[${escapeCdata(reply.title ?? '')}]]></Title>
    <Description><![CDATA[${escapeCdata(reply.description ?? '')}]]></Description>
    <MusicUrl><![CDATA[${escapeCdata(reply.musicUrl ?? '')}]]></MusicUrl>
    <HQMusicUrl><![CDATA[${escapeCdata(reply.hqMusicUrl ?? reply.musicUrl ?? '')}]]></HQMusicUrl>
    <ThumbMediaId><![CDATA[${escapeCdata(reply.thumbMediaId)}]]></ThumbMediaId>
  </Music>`,
  );
}

/**
 * 回复图文消息
 * 官方规格：最多 8 条（超出部分自动截断），第一条为封面大图。
 * article 字段：Title / Description / PicUrl / Url
 */
function buildNewsXml(from: string, to: string, articles: [NewsItem, ...NewsItem[]]): string {
  // 官方硬限制：最多 8 条
  const capped = articles.slice(0, 8) as [NewsItem, ...NewsItem[]];

  const items = capped
    .map(
      (a) => `<item>
      <Title><![CDATA[${escapeCdata(a.title)}]]></Title>
      <Description><![CDATA[${escapeCdata(a.description)}]]></Description>
      <PicUrl><![CDATA[${escapeCdata(a.picUrl)}]]></PicUrl>
      <Url><![CDATA[${escapeCdata(a.url)}]]></Url>
    </item>`,
    )
    .join('\n');

  return wrapXml(
    from,
    to,
    'news',
    `<ArticleCount>${capped.length}</ArticleCount><Articles>${items}</Articles>`,
  );
}

function wrapXml(from: string, to: string, msgType: string, body: string): string {
  const now = Math.floor(Date.now() / 1000);
  return `<xml>
  <ToUserName><![CDATA[${escapeCdata(to)}]]></ToUserName>
  <FromUserName><![CDATA[${escapeCdata(from)}]]></FromUserName>
  <CreateTime>${now}</CreateTime>
  <MsgType><![CDATA[${escapeCdata(msgType)}]]></MsgType>
  ${body}
</xml>`;
}

// ── 格式转换工具 ─────────────────────────────────────────────────────────────
