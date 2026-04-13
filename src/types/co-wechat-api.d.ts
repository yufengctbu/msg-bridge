/**
 * co-wechat-api 类型声明（库本身无 @types 包）。
 * 覆盖本项目当前及潜在使用的所有主要方法，完整 API 参见：
 * https://github.com/node-webot/co-wechat-api
 *
 * 能力分区：
 *   - 客服消息（sendText / sendImage / sendVoice / sendVideo / sendMusic / sendNews ...）
 *   - 模板消息（sendTemplate）
 *   - 订阅消息（sendSubscribeMessage）
 *   - 用户管理（getUser / batchGetUsers / getFollowers）
 *   - 自定义菜单（createMenu / getMenu / deleteMenu）
 *   - 群发消息（massSend / uploadNews）
 *   - 素材管理（uploadMedia / uploadMaterial）
 */
declare module 'co-wechat-api' {
  // ── Token 管理 ────────────────────────────────────────────────────────────

  interface AccessToken {
    accessToken: string;
    expireTime: number;
    isValid(): boolean;
  }

  type GetTokenFn = () => Promise<AccessToken | null>;
  type SaveTokenFn = (token: AccessToken) => Promise<void>;

  // ── 客服消息相关接口 ───────────────────────────────────────────────────────

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

  interface MiniProgramCard {
    /** 小程序标题，必填 */
    title: string;
    /** 小程序 AppID，必填 */
    appid: string;
    /** 小程序内页面路径（可带参数），选填 */
    pagepath?: string;
    /** 缩略图 media_id，必填 */
    thumb_media_id: string;
  }

  // ── 模板消息相关接口 ───────────────────────────────────────────────────────

  /**
   * 模板消息数据字段。每个 key 对应模板中的占位符，value 为渲染值。
   * 例：{ first: { value: '您好', color: '#173177' }, amount: { value: '100元' } }
   */
  interface TemplateData {
    [key: string]: {
      value: string;
      color?: string;
    };
  }

  interface TemplateMessageMiniprogram {
    appid: string;
    pagepath?: string;
  }

  // ── 订阅消息相关接口 ───────────────────────────────────────────────────────

  /** 订阅消息（小程序）数据字段 */
  interface SubscribeMessageData {
    [key: string]: { value: string };
  }

  // ── 用户管理相关接口 ───────────────────────────────────────────────────────

  interface WechatUser {
    subscribe: 0 | 1;
    openid: string;
    nickname?: string;
    sex?: 0 | 1 | 2;
    language?: string;
    city?: string;
    province?: string;
    country?: string;
    headimgurl?: string;
    subscribe_time?: number;
    unionid?: string;
    remark?: string;
    groupid?: number;
    tagid_list?: number[];
    subscribe_scene?: string;
    qr_scene?: number;
    qr_scene_str?: string;
  }

  interface FollowerList {
    total: number;
    count: number;
    data: { openid: string[] };
    next_openid: string;
  }

  // ── 群发消息相关接口 ───────────────────────────────────────────────────────

  interface MassSendResult {
    errcode: number;
    errmsg: string;
    msg_id?: number;
  }

  /** 群发消息选项（按 tag 或按 openid 列表发送） */
  interface MassSendByTagOpts {
    filter: { is_to_all: boolean; tag_id?: number };
    msgtype: string;
    [key: string]: unknown;
  }

  interface MassSendByOpenidsOpts {
    touser: string[];
    msgtype: string;
    [key: string]: unknown;
  }

  // ── 素材管理相关接口 ───────────────────────────────────────────────────────

  interface UploadResult {
    type: string;
    media_id: string;
    created_at: number;
  }

  // ── 自定义菜单相关接口 ─────────────────────────────────────────────────────

  interface MenuButton {
    type?: string;
    name: string;
    key?: string;
    url?: string;
    sub_button?: MenuButton[];
    appid?: string;
    pagepath?: string;
  }

  interface Menu {
    button: MenuButton[];
  }

  // ── API 主类 ───────────────────────────────────────────────────────────────

  class WechatAPI {
    constructor(appid: string, appsecret: string, getToken?: GetTokenFn, saveToken?: SaveTokenFn);

    /** 获取 access_token（自动缓存 & 刷新） */
    getAccessToken(): Promise<AccessToken>;
    /** 确保 access_token 有效（内部使用） */
    ensureAccessToken(): Promise<AccessToken>;

    // ── 客服消息 ──────────────────────────────────────────────────────────────
    // 通过客服接口发送，不受 5s 被动回复时限
    sendText(openid: string, text: string): Promise<unknown>;
    sendImage(openid: string, mediaId: string): Promise<unknown>;
    sendVoice(openid: string, mediaId: string): Promise<unknown>;
    sendVideo(openid: string, mediaId: string, thumbMediaId: string): Promise<unknown>;
    sendMusic(openid: string, music: MusicInfo): Promise<unknown>;
    sendNews(openid: string, articles: NewsArticle[]): Promise<unknown>;
    /** 发送图文消息（点击跳转到图文消息页面） */
    sendMpNews(openid: string, mediaId: string): Promise<unknown>;
    /** 发送卡券 */
    sendCard(openid: string, cardId: string): Promise<unknown>;
    /** 发送小程序卡片（需公众号与小程序已关联） */
    sendMiniProgram(openid: string, miniprogram: MiniProgramCard): Promise<unknown>;

    // ── 模板消息 ──────────────────────────────────────────────────────────────
    /**
     * 发送模板消息（服务号专属，需在公众平台申请模板 ID）。
     * @param openid       接收者 openid
     * @param templateId   模板 ID
     * @param url          模板跳转链接（留空则不跳转）
     * @param topColor     顶部颜色（如 '#FF0000'）；传 null 使用模板默认色
     * @param data         模板数据，key 为占位符名，value.value 为填充值
     * @param miniprogram  跳转小程序信息（可选，优先级高于 url）
     */
    sendTemplate(
      openid: string,
      templateId: string,
      url: string,
      topColor: string | null,
      data: TemplateData,
      miniprogram?: TemplateMessageMiniprogram,
    ): Promise<{ errcode: number; errmsg: string; msgid?: number }>;

    // ── 订阅消息（小程序）────────────────────────────────────────────────────
    /**
     * 发送订阅消息（小程序场景，用户主动订阅后才能发送）。
     * @param openid     接收者 openid
     * @param templateId 订阅消息模板 ID
     * @param page       点击消息后跳转的小程序页面路径
     * @param data       模板数据
     */
    sendSubscribeMessage(
      openid: string,
      templateId: string,
      page: string,
      data: SubscribeMessageData,
    ): Promise<unknown>;

    // ── 用户管理 ──────────────────────────────────────────────────────────────
    /**
     * 获取单个用户基本信息。
     * @param options openid 字符串，或 { openid, lang } 对象（lang 默认 'zh_CN'）
     */
    getUser(
      options: string | { openid: string; lang?: 'zh_CN' | 'zh_TW' | 'en' },
    ): Promise<WechatUser>;
    /**
     * 批量获取用户基本信息（一次最多 100 个）。
     */
    batchGetUsers(
      openids: string[],
      lang?: 'zh_CN' | 'zh_TW' | 'en',
    ): Promise<{ user_info_list: WechatUser[] }>;
    /**
     * 获取关注者 openid 列表（每次最多 10000 个，通过 next_openid 翻页）。
     */
    getFollowers(nextOpenid?: string): Promise<FollowerList>;

    // ── 自定义菜单 ────────────────────────────────────────────────────────────
    createMenu(menu: Menu): Promise<unknown>;
    getMenu(): Promise<{ menu: Menu }>;
    deleteMenu(): Promise<unknown>;

    // ── 群发消息 ──────────────────────────────────────────────────────────────
    /**
     * 根据标签/openid 列表群发消息。
     * 适合向大量用户推送内容，不受客服消息的"48小时窗口"限制。
     */
    massSend(
      opts: MassSendByTagOpts | MassSendByOpenidsOpts,
      receivers?: string[],
    ): Promise<MassSendResult>;
    /** 上传图文消息素材，供群发使用 */
    uploadNews(news: { articles: object[] }): Promise<UploadResult>;

    // ── 素材管理 ──────────────────────────────────────────────────────────────
    /**
     * 上传临时素材（有效期 3 天）。
     * @param filepath 本地文件路径
     * @param type     素材类型：'image' | 'voice' | 'video' | 'thumb'
     */
    uploadMedia(
      filepath: string,
      type: 'image' | 'voice' | 'video' | 'thumb',
    ): Promise<UploadResult>;

    /** 设置 HTTP 请求默认选项（如 timeout） */
    setOpts(opts: Record<string, unknown>): void;
  }

  export = WechatAPI;
}
