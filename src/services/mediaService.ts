import fs from 'node:fs/promises';
import { wechatApi } from './wechatApi';

export type MediaType = 'image' | 'voice' | 'video' | 'thumb';

/**
 * 删除 multer 写入的本地临时文件。
 * 在上传路由的 early-return 分支（参数校验失败）中使用，
 * 避免因未调用 uploadTempMedia 而导致临时文件泄漏。
 */
export async function cleanupTempFile(filepath: string): Promise<void> {
  await fs.unlink(filepath).catch((err) => {
    console.warn(`[media] 临时文件删除失败: ${filepath}`, err);
  });
}

/**
 * 上传临时素材到微信，返回 media_id（有效期 3 天）。
 * 上传完成后自动删除本地临时文件，无论成功与否。
 *
 * @param filepath 本地临时文件路径（multer 写入的临时文件）
 * @param type     素材类型：image / voice / video / thumb
 * @returns        微信返回的 media_id
 */
export async function uploadTempMedia(filepath: string, type: MediaType): Promise<string> {
  try {
    const result = await wechatApi.uploadMedia(filepath, type);
    return result.media_id;
  } finally {
    await fs.unlink(filepath).catch((err) => {
      console.warn(`[media] 临时文件删除失败: ${filepath}`, err);
    });
  }
}
