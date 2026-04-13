/**
 * co-wechat-api 类型声明（库本身无 @types 包）。
 * 仅覆盖本项目使用的方法，完整 API 参见：
 * https://github.com/node-webot/co-wechat-api
 */
declare module 'co-wechat-api' {
  interface AccessToken {
    accessToken: string;
    expireTime: number;
    isValid(): boolean;
  }

  type GetTokenFn = () => Promise<AccessToken | null>;
  type SaveTokenFn = (token: AccessToken) => Promise<void>;

  interface NewsArticle {
    title: string;
    description: string;
    url: string;
    picurl: string;
  }

  interface MusicInfo {
    title?: string;
    description?: string;
    musicurl: string;
    hqmusicurl?: string;
    thumb_media_id: string;
  }

  interface UploadResult {
    type: string;
    media_id: string;
    created_at: number;
  }

  class WechatAPI {
    constructor(appid: string, appsecret: string, getToken?: GetTokenFn, saveToken?: SaveTokenFn);

    /** 获取 access_token（自动缓存 & 刷新） */
    getAccessToken(): Promise<AccessToken>;

    /** 确保 access_token 有效（内部调用，外部一般不直接用） */
    ensureAccessToken(): Promise<AccessToken>;

    // ── 客服消息 ────────────────────────────────────────────
    sendText(openid: string, text: string): Promise<unknown>;
    sendImage(openid: string, mediaId: string): Promise<unknown>;
    sendVoice(openid: string, mediaId: string): Promise<unknown>;
    sendVideo(openid: string, mediaId: string, thumbMediaId: string): Promise<unknown>;
    sendMusic(openid: string, music: MusicInfo): Promise<unknown>;
    sendNews(openid: string, articles: NewsArticle[]): Promise<unknown>;
    sendMpNews(openid: string, mediaId: string): Promise<unknown>;

    // ── 素材管理 ────────────────────────────────────────────
    uploadMedia(filepath: string, type: string): Promise<UploadResult>;

    /** 设置 HTTP 请求默认选项 */
    setOpts(opts: Record<string, unknown>): void;
  }

  export = WechatAPI;
}
