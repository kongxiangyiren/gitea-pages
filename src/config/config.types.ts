/** 外部 config.js / 内部默认值共用的配置类型 */
export interface PagesConfig {
  /** 服务器端口 */
  port?: number;
  /** pages 服务域名（用于子域名解析基准），结尾无 `/`，可含端口 */
  pagesDomainName: string;
  /** Gitea 实例地址，结尾无 `/` */
  giteaUrl: string;
  /** 用户白名单（非空时黑名单失效） */
  whiteList?: string[];
  /** 用户黑名单（whiteList 非空时失效） */
  blackList?: string[];
  /** 命中则 Cache-Control 30 天；`false` 关闭该项 */
  cacheSuffixName?: RegExp | false;
  /** gzip 压缩配置 */
  gzip?: {
    enable: boolean;
    threshold: number;
  };
  /**
   * 缓存配置（文件树 / CNAME，TTL 10 分钟），与原 ThinkJS 版格式一致：
   * - type: 'file'（默认，落盘 ./runtime/cache，重启不丢）| 'redis'（多实例共享）| 'memory'
   * - file: 文件缓存配置
   * - redis: Redis 连接配置（type 为 'redis' 时生效；也支持直接传 URI 字符串）
   */
  cache?: {
    type?: 'file' | 'redis' | 'memory';
    file?: {
      /** 缓存数据文件路径，默认 ./runtime/cache/data.json（相对进程 cwd） */
      dir?: string;
      /** 过期数据回收间隔（毫秒），默认 24 小时 */
      gcInterval?: number;
    };
    redis?:
      | string
      | {
          /** Redis 主机，默认 127.0.0.1 */
          host?: string;
          /** Redis 端口，默认 6379 */
          port?: number;
          /** 用户名（Redis >= 6） */
          username?: string;
          /** 密码 */
          password?: string;
          /** 数据库编号，默认 0 */
          db?: number;
        };
  };
}

/** 运行时最终配置（合并默认值后，字段全部就绪） */
export interface ResolvedConfig {
  port: number;
  pagesDomainName: string;
  giteaUrl: string;
  whiteList: string[];
  blackList: string[];
  cacheSuffixName: RegExp | false;
  gzip: {
    enable: boolean;
    threshold: number;
  };
  cache?: {
    type?: 'file' | 'redis' | 'memory';
    file?: {
      dir?: string;
      gcInterval?: number;
    };
    redis?:
      | string
      | {
          host?: string;
          port?: number;
          username?: string;
          password?: string;
          db?: number;
        };
  };
}

export const CONFIG_DEFAULTS = {
  port: 8360,
  pagesDomainName: 'localhost:8360',
  giteaUrl: 'https://gitea.com',
  whiteList: [] as string[],
  blackList: [] as string[],
  cacheSuffixName: /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i as
    RegExp | false,
  gzip: {
    enable: true,
    threshold: 1024,
  },
};
