// 生产环境使用：本文件放在进程工作目录（cwd），启动时读取；不存在时使用内置默认值
module.exports = {
  // 服务器端口（环境变量 PORT 优先级更高）
  port: 8360,
  // pages 服务域名（用于子域名解析基准，可含端口，结尾无 /）
  pagesDomainName: 'localhost:8360',
  // Gitea 实例地址，结尾不要 /
  giteaUrl: 'https://gitea.com',
  // 用户白名单（非空时黑名单失效）
  whiteList: [],
  // 用户黑名单（whiteList 配置了就失效）
  blackList: [],
  // 命中扩展名则 Cache-Control 缓存 30 天；设为 false 关闭
  cacheSuffixName: /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i,
  // gzip 压缩
  gzip: {
    // 压缩开关
    enable: true,
    // 要压缩的最小响应大小（字节），默认 1024
    threshold: 1024,
  },
  // 缓存（文件树 / CNAME，TTL 10 分钟）：文件树缓存为 10 分钟，如果缓存文件 404，将会刷新文件树
  cache: {
    type: 'file', // redis 或者 file（memory 为纯内存）
    // 文件缓存（默认落盘 ./runtime/cache，重启不丢）
    file: {
      gcInterval: 24 * 60 * 60 * 1000, // gc interval
      // dir: './runtime/cache' // 自定义缓存目录
    },
    // redis 缓存配置（type: 'file' 时生效；也支持 URI: redis: 'redis://127.0.0.1:6379/0'）
    redis: {
      port: 6390,
      host: '127.0.0.1',
      // username: 'default', // needs Redis >= 6
      password: '',
      db: 0,
    },
  },
};
