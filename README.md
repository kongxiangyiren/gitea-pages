# Gitea Pages

## 可执行文件下载地址

[github](https://github.com/kongxiangyiren/gitea-pages/releases/latest)

## 注意

1、只支持pages仓库的main分支,对应域名为`<用户名>.<domain>`
2、暂不支持自动申请ssl证书

## 可执行文件部署

### iis 部署

1、下载gitea-pages-win.exe

[github](https://github.com/kongxiangyiren/gitea-pages/releases/latest)

2、[下载安装 aspNetCore](https://dotnet.microsoft.com/zh-cn/download/dotnet/thank-you/runtime-aspnetcore-8.0.0-windows-hosting-bundle-installer)

3、双击运行gitea-pages-win.exe

4、修改生成的`config.js`中的`port: 8360` 为`port: process.env.ASPNETCORE_PORT`

如：

```javascript
// 生产环境使用
module.exports = {
  // workers: 0, // 进程数(最大为cpu数，0为全部启用)
  port: process.env.ASPNETCORE_PORT, // 服务器端口,默认 8360
  // pages 服务器域名
  pagesDomainName: 'localhost',
  // gitea url 结尾不要 /
  giteaUrl: 'https://gitea.com',
  // user 白名单
  whiteList: [],
  // user 黑名单 如果whiteList配置了就失效
  blackList: [],
  // 缓存文件后缀名，如果匹配设置缓存30天
  cacheSuffixName: /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i
};
```

5、自行修改`config.js`的其他配置

6、创建web.config

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath=".\gitea-pages-win.exe" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="outofprocess" />
    </system.webServer>
  </location>
</configuration>
```

### linux 部署

1、下载gitea-pages-linux

[github](https://github.com/kongxiangyiren/gitea-pages/releases/latest)

2、运行gitea-pages-linux

```sh
./gitea-pages-linux
```

3、修改生成的`config.js`

4、 持久运行

```
nohup ./gitea-pages-linux &
```

5、 Nginx代理

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
    # proxy_hide_header Upgrade;

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
