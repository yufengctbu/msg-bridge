/**
 * 基于 MsgId 的内存去重缓存，用于防止微信服务器重试同一条消息时被重复处理。
 *
 * 微信重试策略：5s 超时 → 重试，最多重试 3 次（间隔约 5s / 15s / 25s）。
 * 缓存 TTL 设为 60 秒，足以覆盖全部重试窗口。
 *
 * 注意：此实现为单进程内存缓存，多实例部署时请替换为 Redis SET + EXPIRE。
 */

const TTL_MS = 60_000; // 60 秒

interface CacheEntry {
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** 定期清理已过期的条目，避免内存无限增长（每 60 秒执行一次） */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}, TTL_MS);

// 不阻止进程退出
cleanupInterval.unref();

/**
 * 检查 msgId 是否已处理过。
 * @returns `true` 表示重复（应跳过），`false` 表示首次处理（已写入缓存）
 */
export function isDuplicate(msgId: string): boolean {
  const now = Date.now();
  const entry = cache.get(msgId);

  if (entry && entry.expiresAt > now) {
    return true; // 重复消息
  }

  cache.set(msgId, { expiresAt: now + TTL_MS });
  return false;
}

/** 当前缓存条目数（仅用于调试/监控） */
export function cacheSize(): number {
  return cache.size;
}
