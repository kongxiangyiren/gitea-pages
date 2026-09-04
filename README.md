# Gitea Pages


## 注意

1. 只支持 pages 仓库的 **main** 分支，对应域名为 `<用户名>.<domain>`
2. 暂不支持自动申请 ssl 证书
3. 在 `main` 分支根目录创建 `.spa` 空白文件支持 spa 项目
4. 在 `main` 分支根目录创建 `CNAME` 文件绑定自定义域名（需 DNS 添加 CNAME 记录指向 `<用户名>.<domain>`）

## 相比原版的优化

- 基于 Keyv 的缓存抽象：`file`（落盘重启不丢）/ `redis`（多实例共享）/ `memory`
- `ETag/304` 条件请求：文件内容未变化时省去重复下载
- 流式透传 + keep-alive 连接池，大文件不占内存
- 异步 DNS 解析（替代阻塞的 dns-sync）
- `type: 'redis'` 时启动即探活，连接失败直接退出（fail-fast）
- `/healthz` 健康检查端点、`x-request-id` 请求追踪

## 本地开发

```bash
# 安装依赖
$ pnpm install

# 开发模式（watch）
$ pnpm run start:dev

# 单元测试 / e2e 测试
$ pnpm run test
$ pnpm run test:e2e

# 构建（tsdown 打包为单文件 dist/main.mjs，依赖全量内联）
$ pnpm build

# 生产运行
$ pnpm run start:prod
```

## 配置

配置文件为项目根目录的 `config.js`（不存在时使用内置默认值），修改后重启生效：

```javascript
// 生产环境使用
module.exports = {
  // 服务器端口（环境变量 PORT 优先级更高），默认 8360
  port: 8360,
  // pages 服务器域名（用于子域名解析基准，可含端口，结尾无 /）
  pagesDomainName: 'localhost:8360',
  // gitea url 结尾不要 /
  giteaUrl: 'https://gitea.com',
  // user 白名单
  whiteList: [],
  // user 黑名单 如果 whiteList 配置了就失效
  blackList: [],
  // 缓存文件后缀名，如果匹配设置缓存 30 天；设为 false 关闭
  cacheSuffixName: /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i,
  // gzip
  gzip: {
    // gzip 开关
    enable: true,
    // 要压缩的最小响应大小(以字节为单位)。默认为 1024 字节或 1KB。
    threshold: 1024,
  },
  // 缓存（文件树 / CNAME，TTL 10 分钟，如果缓存文件 404，将会刷新文件树）
  cache: {
    type: 'file', // redis 或者 file（memory 为纯内存）
    // 文件缓存（默认落盘 ./runtime/cache/data.json，重启不丢）
    file: {
      gcInterval: 24 * 60 * 60 * 1000, // gc interval
      // dir: './runtime/cache' // 自定义缓存数据文件路径
    },
    // redis 缓存配置（type: 'redis' 时生效；也支持 URI 写法）
    redis: {
      port: 6379,
      host: '127.0.0.1',
      // username: 'default', // needs Redis >= 6
      password: '',
      db: 0,
    },
  },
};
```

> `type: 'redis'` 时服务启动会立即连接 Redis，连接失败将**报错退出**，避免带病运行。多实例部署请使用 redis 共享缓存。

## 部署

### Docker 部署（推荐）

```bash
docker compose up -d
```

`docker-compose.yaml` 已配置：

- 端口 `8360:8360`
- `./config.js` 只读挂载（修改后 `docker compose restart gitea-pages` 生效）
- `./runtime` 挂载持久化文件缓存（容器重建后缓存不丢）
- `/healthz` 健康检查自愈

> Linux 宿主机首次使用请确保 runtime 目录可写：`mkdir -p runtime && sudo chown -R 1000:1000 runtime`

### pm2 部署

```bash
# 构建后启动
pnpm build
pm2 start pm2.json
```

### 裸跑 / nohup

```bash
pnpm build
node dist/main.mjs

# 持久运行
nohup node dist/main.mjs &
```

### 单文件可执行程序（可选）

构建产物 `dist/main.mjs` 已内联全部依赖，只需目标机器有 Node.js（无需 npm install）。

如需打包为独立可执行文件（内置 Node.js 运行时，无需安装 Node）：

```bash
# 需要 Node.js >= 25.7.0；下载走 npmmirror 镜像
TS_EXE=1 npx tsdown
# 产物在 build/ 目录：gitea-pages-linux-x64 / gitea-pages-win-x64 等
```

## Nginx 代理

子域名路由依赖 `Host` 头，反代必须透传：

```nginx
#PROXY-START/

location ^~ /
{
    proxy_pass http://127.0.0.1:8360/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header REMOTE-HOST $remote_addr;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-Proto $scheme;

    add_header X-Cache $upstream_cache_status;

    #Set Nginx Cache
    set $static_gitea_pages 0;
    if ( $uri ~* "\.(gif|png|jpg|css|js|woff|woff2)$" )
    {
        set $static_gitea_pages 1;
        expires 1m;
    }
    if ( $static_gitea_pages = 0 )
    {
        add_header Cache-Control no-cache;
    }
}

#PROXY-END/
```

## 三步启用你的静态站点

1. 在 Gitea 创建名为 `pages` 的**公开**仓库
2. 把静态网站文件推送到 `main` 分支根目录
3. 访问 `http://<用户名>.<pagesDomainName>` 即可

自定义域名：在仓库根目录放置 `CNAME` 文件（内容为你的域名），并把 DNS CNAME 记录指向 `<用户名>.<pagesDomainName>`。

## License

[MIT](LICENSE)
