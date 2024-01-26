import Base from './base.js';
import axios from 'axios';
import dnsSync from 'dns-sync';
import mime from 'mime';
import { extname } from 'path';
import { types } from 'util';
export default class extends Base {
  async indexAction(): Promise<any> {
    const pages = this.removeLastOccurrence(this.ctx.host, this.config('pagesDomainName'));

    if (pages === false) {
      // 如果当前host 不匹配 pagesDomainName 404
      this.ctx.status = 404;
      return this.display('404');
    } else {
      const pagesList = pages.split('.');
      if (pagesList.length === 1) {
        // 当前host与pagesDomainName一致
        if (this.ctx.url !== '/') {
          this.ctx.status = 404;
          return this.display('404');
        }
        return this.display('index');
      } else if (pagesList.length === 2) {
        // 有Gitea用户名

        // 如果白名单存在,并且不存在pagesList[0]
        const whiteList = Array.isArray(this.config('whiteList')) ? this.config('whiteList') : [];
        if (!think.isEmpty(whiteList) && !whiteList.includes(pagesList[0])) {
          this.ctx.status = 404;
          return this.display('404');
        }
        // 如果白名单不存在,黑名单存在,并且不存在pagesList[0]
        const blackList = Array.isArray(this.config('blackList')) ? this.config('blackList') : [];
        if (
          think.isEmpty(whiteList) &&
          !think.isEmpty(blackList) &&
          blackList.includes(pagesList[0])
        ) {
          this.ctx.status = 404;
          return this.display('404');
        }

        // 获取文件树缓存
        let tree: Array<{
          path: string;
          type: string;
        }> = await this.cache(`gitea-pages:tree:${pagesList[0]}`);
        if (think.isEmpty(tree)) {
          let trees;
          // 获取项目根目录文件树
          try {
            trees = await axios.get(
              `${this.config('giteaUrl')}/api/v1/repos/${
                pagesList[0]
              }/pages/git/trees/main?recursive=true`
            );
          } catch (error) {
            this.ctx.status = 404;
            return this.display('404');
          }
          if (!(trees && trees.data && trees.data.tree)) {
            this.ctx.status = 404;
            return this.display('404');
          }
          const data = (
            trees.data.tree as Array<{
              path: string;
              mode: string;
              type: string;
              size: number;
              sha: string;
              url: string;
            }>
          ).map((item) => ({
            ...item,
            mode: undefined,
            size: undefined,
            url: undefined,
            sha: undefined
          }));
          tree = data;
          // 缓存10分钟
          await this.cache(`gitea-pages:tree:${pagesList[0]}`, data, {
            timeout: 10 * 60 * 1000
          });
        }

        // 判断有没有 CNAME 文件
        if (tree.find((item) => item.path === 'CNAME')) {
          // 获取cname缓存
          let CNAME = await this.cache(`gitea-pages:cname:${pagesList[0]}`);
          // 如果缓存不存在
          if (think.isEmpty(CNAME)) {
            try {
              const response = await axios.get(
                `${this.config('giteaUrl')}/${pagesList[0]}/pages/raw/branch/main/CNAME`
              );
              if (this.isDomain(response.data.toString().trim())) {
                CNAME = response.data.toString().trim();
                await this.cache(
                  `gitea-pages:cname:${pagesList[0]}`,
                  response.data.toString().trim(),
                  {
                    timeout: 10 * 60 * 1000
                  }
                );
              }
            } catch (error) {}
          }

          if (this.ctx.host !== CNAME) {
            this.ctx.status = 301;
            return this.redirect(`http://${CNAME}${this.ctx.url}`);
          }
        }
        // url解析
        this.ctx.url = this.ctx.url === '/' ? '/index.html' : this.ctx.url;
        if (
          !['CNAME', '.github', '404.html', '.spa'].includes(this.ctx.url.split('/')[1]) &&
          tree.find((item) => item.path === this.ctx.url.slice(1) && item.type !== 'tree')
        ) {
          try {
            const url = `${this.config('giteaUrl')}/${pagesList[0]}/pages/raw/branch/main${
              this.ctx.url
            }`;
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            // 修改MIME类型
            this.ctx.set(
              'Content-Type',
              mime.getType(
                this.ctx.url.split('/').pop() === '' ? 'index.html' : this.ctx.url.split('/').pop()
              ) ?? 'text/plain'
            );

            // 设置缓存30天
            if (
              // 匹配正则
              !think.isEmpty(this.config('cacheSuffixName')) &&
              types.isRegExp(this.config('cacheSuffixName')) &&
              this.config('cacheSuffixName').test(extname(this.ctx.url.split('/').pop()))
            ) {
              this.ctx.set('cache-control', 'max-age=' + 30 * 24 * 60 * 60);
            } else if (
              // 不匹配正则且不是false
              this.config('cacheSuffixName') !== false &&
              /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i.test(
                extname(this.ctx.url.split('/').pop())
              )
            ) {
              this.ctx.set('cache-control', 'max-age=' + 30 * 24 * 60 * 60);
            }
            this.ctx.status = 200;
            return (this.ctx.body = response.data); // 将响应数据设置为Koa的响应体
          } catch (error) {
            await this.cache(`gitea-pages:tree:${pagesList[0]}`, null);
            await this.cache(`gitea-pages:cname:${pagesList[0]}`, null);
          }
        }
        // 文件更新，更新缓存
        if (think.isEmpty(tree)) {
          return this.indexAction();
        }

        // spa 项目判断
        if (
          tree.find((item) => item.path === '.spa' && item.type !== 'tree') &&
          tree.find((item) => item.path === 'index.html' && item.type !== 'tree')
        ) {
          this.ctx.url = '/';
          this.ctx.status = 200;
          return this.indexAction();
        }

        // 有404页
        if (tree.find((item) => item.path === '404.html' && item.type !== 'tree')) {
          try {
            const response = await axios.get(
              `${this.config('giteaUrl')}/${pagesList[0]}/pages/raw/branch/main/404.html`
            );
            this.ctx.status = 404;
            return (this.ctx.body = response.data);
          } catch (error) {}
        }

        // 默认404
        this.ctx.status = 404;
        return this.display('404');
      } else {
        // 有Gitea用户名 但是 多了
        this.ctx.status = 404;
        return this.display('404');
      }
    }
  }
  // 判断url是否匹配
  removeLastOccurrence(a: string, b: string): string | false {
    // 检查a的最后几位是否匹配b
    if (a.endsWith(b)) {
      // 反转字符串a和b
      const reversedA = a.split('').reverse().join('');
      const reversedB = b.split('').reverse().join('');

      // 在反转后的a中去掉第一个匹配的反转后的b
      const updatedReversedA = reversedA.replace(reversedB, '');

      // 反转回原始顺序并返回结果
      return updatedReversedA.split('').reverse().join('');
    }
    // 判断 cname记录是否匹配
    if (!think.isEmpty(dnsSync.resolve(a, 'CNAME'))) {
      return this.removeLastOccurrence(dnsSync.resolve(a, 'CNAME')[0] as string, b);
    }
    // 如果没有匹配，则返回原始字符串a
    return false;
  }
  // 判断是不是一个域名
  isDomain(str: string) {
    const pattern = /^([0-9a-zA-Z-]{1,}\.)+([a-zA-Z]{2,})$/;
    return pattern.test(str);
  }
}
