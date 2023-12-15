# Gitea Pages

## Run File Download

[github](https://github.com/kongxiangyiren/gitea-pages/releases/latest)

## Features

- Proxies `<owner>.<domain>/` => `owner/pages/main`

## Nginx pseudo-static

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
