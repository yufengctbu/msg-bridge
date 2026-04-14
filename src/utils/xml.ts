/**
 * 从微信推送的原始 XML body 中提取去重键。
 *
 * - 普通消息（text / image / voice 等）：直接使用 MsgId
 * - 事件消息（subscribe / CLICK 等）：无 MsgId，用 FromUserName + CreateTime + Event 拼接
 * - 无法识别的格式：返回空字符串，调用方应跳过去重
 */
export function extractMsgKey(body: string): string {
  const msgId = body.match(/<MsgId>(\d+)<\/MsgId>/)?.[1];
  if (msgId) return msgId;

  return [
    body.match(/<FromUserName><!\[CDATA\[(.+?)]]>/)?.[1],
    body.match(/<CreateTime>(\d+)<\/CreateTime>/)?.[1],
    body.match(/<Event><!\[CDATA\[(.+?)]]>/)?.[1],
  ]
    .filter(Boolean)
    .join('-');
}
