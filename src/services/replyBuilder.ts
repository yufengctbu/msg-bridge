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
    case 'markdown':
      return buildTextXml(from, to, markdownToText(reply.content));
    case 'code':
      return buildTextXml(from, to, codeToText(reply.language, reply.code));
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

const DIVIDER = '─'.repeat(22);

/**
 * 将 Markdown 转为视觉结构清晰的纯文本，适合微信消息展示。
 *
 * 微信被动回复不渲染 HTML / Markdown，但通过 Unicode 装饰字符
 * （┆ ▌ 「」 • ─ 等）和合理换行，可呈现层次感。
 *
 * 转换规则：
 *   # H1       →  ▌ 标题\n──────────────────────
 *   ## H2      →  【标题】
 *   ### H3+    →  ▶ 标题
 *   **粗体**   →  「粗体」（中英文通用，Unicode 数学粗体仅覆盖 ASCII）
 *   *斜体*     →  去标记保留内容
 *   `code`     →  [code]
 *   链接       →  文字（URL）
 *   - 列表     →  • / ◦ / ▪（三级嵌套）
 *   > 引用     →  ┆ 引用内容
 *   ---        →  ──────────────────────
 *   ```块```   →  ┌──── [lang] ─\n代码\n└────────
 */
function markdownToText(md: string): string {
  let text = md.replace(/\r\n/g, '\n');

  // ① 先提取代码围栏，避免内部内容被后续规则误处理
  const fences: string[] = [];
  text = text.replace(
    /```([\w]*)\n?([\s\S]*?)```/g,
    (_match: string, lang: string, code: string) => {
      const placeholder = `\uFFFEfence${fences.length}\uFFFE`;
      fences.push(codeToText(lang.trim(), code.trim()));
      return placeholder;
    },
  );

  text = text
    // 标题分级
    .replace(/^# (.+)$/gm, `\n▌ $1\n${DIVIDER}`)
    .replace(/^## (.+)$/gm, '\n【$1】')
    .replace(/^### (.+)$/gm, '\n▶ $1')
    .replace(/^#{4,6} (.+)$/gm, '\n◆ $1')
    // 粗体（含粗斜体）→ 「」高亮
    .replace(/\*{3}(.+?)\*{3}/g, '「$1」')
    .replace(/\*\*(.+?)\*\*/g, '「$1」')
    // 斜体 → 去标记
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\b_(.+?)_\b/g, '$1')
    // 删除线 → 去标记
    .replace(/~~(.+?)~~/g, '$1')
    // 行内代码
    .replace(/`(.+?)`/g, '[$1]')
    // 链接
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1（$2）')
    // 无序列表（三级嵌套：• ◦ ▪）
    .replace(/^(\s*)[-*+] (.+)$/gm, (_match: string, indent: string, content: string) => {
      const level = Math.min(Math.floor(indent.length / 2), 2);
      return `${'  '.repeat(level)}${{ 0: '•', 1: '◦', 2: '▪' }[level]} ${content}`;
    })
    // 有序列表
    .replace(
      /^(\s*)(\d+)\. (.+)$/gm,
      (_match: string, indent: string, num: string, content: string) => {
        return `${'  '.repeat(Math.floor(indent.length / 2))}${num}. ${content}`;
      },
    )
    // 引用块
    .replace(/^> (.+)$/gm, '  ┆ $1')
    // 分割线
    .replace(/^[-*_]{3,}$/gm, DIVIDER)
    // 合并超过两个的连续空行
    .replace(/\n{3,}/g, '\n\n');

  // ② 还原代码围栏
  text = text.replace(
    /\uFFFEfence(\d+)\uFFFE/g,
    (_match: string, idx: string) => fences[Number(idx)],
  );

  return text.trim();
}

/**
 * 将代码块格式化为带边框的纯文本，保留缩进和换行。
 *
 * 输出示例：
 *   ┌── [typescript] ──────────────
 *   const x = 1;
 *   └──────────────────────────────
 */
function codeToText(language: string, code: string): string {
  const langTag = language ? ` [${language}] ` : ' ';
  const topBorder = `┌──${langTag}${'─'.repeat(Math.max(0, DIVIDER.length - langTag.length - 2))}`;
  const botBorder = `└${'─'.repeat(DIVIDER.length)}`;
  return `${topBorder}\n${code}\n${botBorder}`;
}
