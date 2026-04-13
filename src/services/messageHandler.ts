import { parseStringPromise } from 'xml2js';

interface WechatMessage {
  MsgType?: string[];
  Content?: string[];
  Event?: string[];
  FromUserName?: string[];
  ToUserName?: string[];
}

/**
 * 解析微信 XML 消息，并返回被动回复 XML
 */
export async function handleMessage(rawXml: string): Promise<string> {
  const parsed = (await parseStringPromise(rawXml)) as { xml: WechatMessage };
  const msg = parsed.xml;

  const from = msg.FromUserName?.[0] ?? '';
  const to = msg.ToUserName?.[0] ?? '';
  const msgType = msg.MsgType?.[0] ?? '';

  // 文本消息：原文回显
  if (msgType === 'text') {
    const content = msg.Content?.[0] ?? '';
    return buildTextReply(to, from, `[msg-bridge] ${content}`);
  }

  // 事件消息：关注/取关
  if (msgType === 'event') {
    const event = msg.Event?.[0] ?? '';
    if (event === 'subscribe') {
      return buildTextReply(to, from, '感谢关注！欢迎使用 msg-bridge。');
    }
    return buildSuccessReply();
  }

  // 其他消息类型直接回复 success
  return buildSuccessReply();
}

function buildTextReply(from: string, to: string, content: string): string {
  const now = Math.floor(Date.now() / 1000);
  return `<xml>
  <ToUserName><![CDATA[${to}]]></ToUserName>
  <FromUserName><![CDATA[${from}]]></FromUserName>
  <CreateTime>${now}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${content}]]></Content>
</xml>`;
}

function buildSuccessReply(): string {
  return 'success';
}
