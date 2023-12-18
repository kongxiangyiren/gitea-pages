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
  blackList: []
};
