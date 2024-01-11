// default config
export = {
  workers: 1,
  host: 'localhost',
  pagesDomainName: 'localhost:8360',
  giteaUrl: 'https://gitea.com',
  cacheSuffixName: /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i,
  whiteList: [],
  blackList: [],
  gzip: {
    enable: true,
    threshold: 1024
  }
};
