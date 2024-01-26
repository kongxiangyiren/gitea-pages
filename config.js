// 生产环境使用
module.exports = {
  // workers: 0, // 进程数(最大为cpu数，0为全部启用)
  port: 8360, // 服务器端口,默认 8360
  // pages 服务器域名
  pagesDomainName: 'localhost:8360',
  // gitea url 结尾不要 /
  giteaUrl: 'https://gitea.com',
  // user 白名单
  whiteList: ['kongxiangyiren'],
  // user 黑名单 如果whiteList配置了就失效
  blackList: [],
  // 缓存文件后缀名，如果匹配设置缓存30天
  cacheSuffixName: /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i,
  // gzip
  gzip: {
    // gzip开关
    enable: true,
    // 要压缩的最小响应大小(以字节为单位)。默认为1024字节或1KB。
    threshold: 1024
  },
  // gitee 文件树缓存 响应速度 (文件树缓存为10分钟,如果缓存文件404，将会刷新文件树)
  cache: {
    type: 'file', // redis 或者 file
    // 文件缓存
    file: {
      gcInterval: 24 * 60 * 60 * 1000 // gc interval
    },
    // redis 缓存 配置
    redis: {
      port: 6379,
      host: '127.0.0.1',
      // username: "default", // needs Redis >= 6
      password: '',
      db: 0
    }
  }
};
