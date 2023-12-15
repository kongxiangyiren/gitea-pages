import Base from './base.js';
import axios from 'axios';
import dnsSync from 'dns-sync';
import mime from 'mime';
export default class extends Base {
  async indexAction() {
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
        this.assign({
          pagesDomainName: this.config('pagesDomainName')
        });
        return this.display('index');
      } else if (pagesList.length === 2) {
        // 有Gitea用户名

        // 如果白名单存在,并且不存在pagesList[0]
        const whiteList = this.config('whiteList') ?? [];
        if (!think.isEmpty(whiteList) && !whiteList.includes(pagesList[0])) {
          this.ctx.status = 404;
          return this.display('404');
        }
        // 如果黑名单存在,并且不存在pagesList[0]
        const blackList = this.config('blackList') ?? [];
        if (!think.isEmpty(blackList) && blackList.includes(pagesList[0])) {
          this.ctx.status = 404;
          return this.display('404');
        }
        // 判断有没有 CNAME 文件
        try {
          const response = await axios.get(
            `${this.config('giteaUrl')}/${pagesList[0]}/pages/raw/branch/main/CNAME`
          );

          if (
            this.isDomain(response.data.toString().trim()) &&
            this.ctx.host !== response.data.toString().trim()
          ) {
            this.ctx.status = 301;
            return this.redirect(`http://${response.data.toString().trim()}${this.ctx.url}`);
          }
        } catch (error) {}

        // url解析
        try {
          const url = `${this.config('giteaUrl')}/${pagesList[0]}/pages/raw/branch/main${
            this.ctx.url === '/' ? '/index.html' : this.ctx.url
          }`;

          const response = await axios.get(url, { responseType: 'arraybuffer' });

          // 修改MIME类型
          this.ctx.set(
            'Content-Type',
            // @ts-expect-error
            mime.getType(
              this.ctx.url.split('/').pop() === '' ? 'index.html' : this.ctx.url.split('/').pop()
            ) ?? 'text/plain'
          );
          this.ctx.body = response.data; // 将响应数据设置为Koa的响应体
        } catch (error) {
          this.ctx.status = error.response.status;
          // 404解析
          if (error.response.status === 404) {
            try {
              const response = await axios.get(
                `${this.config('giteaUrl')}/${pagesList[0]}/pages/raw/branch/main/404.html`
              );
              this.ctx.body = response.data;
            } catch (error) {
              return this.display('404');
            }
          }
        }
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
