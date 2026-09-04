import {
  All,
  Controller,
  Header,
  Inject,
  Logger,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import mime from 'mime';
import { extname } from 'node:path';
import { ConfigService } from '../config/config.service.js';
import {
  PagesCacheService,
  type TreeEntry,
} from '../cache/pages-cache.service.js';
import { GiteaService } from '../gitea/gitea.service.js';
import { CNAME_RESOLVER } from '../cache/cache.constants.js';

/** 缓存 30 天（秒） */
const CACHE_30D = 30 * 24 * 60 * 60;
/** 仓库内特殊文件：不作为普通路径提供 raw 服务 */
const RESERVED_FIRST_SEGMENTS = ['CNAME', '.github', '404.html', '.spa'];
/** Gitea 用户名合法字符 */
const USERNAME_RE = /^[A-Za-z0-9_-]+$/;
/** 原版兜底 Cache-Control 后缀正则（cacheSuffixName 为 false 时不启用，这里仅为对齐语义） */
const FALLBACK_SUFFIX_RE = /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i;

type CnameResolver = (host: string) => Promise<string[]>;

@Controller()
export class PagesController {
  private readonly logger = new Logger(PagesController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: PagesCacheService,
    private readonly gitea: GiteaService,
    @Inject(CNAME_RESOLVER) private readonly resolveCname: CnameResolver,
  ) {}

  @All('{*splat}')
  @Header('X-Powered-By', 'gitea-pages')
  async serve(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      await this.handle(req, res, 0);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res
          .status(404)
          .type('html')
          .send(renderNotFoundPage((error as NotFoundException).message));
        return;
      }
      this.logger.error(`请求处理异常 url=${req.url}`, (error as Error).stack);
      if (!res.headersSent) {
        res.status(500).type('html').send(renderErrorPage());
      } else {
        res.destroy();
      }
    }
  }

  private async handle(
    req: Request,
    res: Response,
    attempt: number,
  ): Promise<void> {
    const pagesDomainName = this.config.get('pagesDomainName');
    const host = req.headers.host ?? '';
    const url = req.url || '/';

    const pages = await this.removeLastOccurrence(host, pagesDomainName);
    if (pages === false) {
      // host 完全不匹配 pagesDomainName（也未通过 CNAME 记录间接匹配）
      throw new NotFoundException(`host ${host} 不属于 ${pagesDomainName}`);
    }

    const pagesList = pages.split('.');
    if (pagesList.length === 1) {
      // 访问的就是 pages 主域名
      if (url !== '/') {
        throw new NotFoundException(`主域名下无子路径: ${url}`);
      }
      res.status(200).type('html').send(renderIndexPage(pagesDomainName));
      return;
    }
    if (pagesList.length !== 2) {
      // 用户名后还有多级子域，不合法
      throw new NotFoundException(`子域名层级不合法: ${pages}`);
    }

    const username = pagesList[0];
    if (!USERNAME_RE.test(username)) {
      throw new NotFoundException(`用户名不合法: ${username}`);
    }

    // 白/黑名单（白名单非空时黑名单失效，与原版一致）
    const { whiteList, blackList } = this.config.getAll();
    if (whiteList.length > 0 && !whiteList.includes(username)) {
      throw new NotFoundException(`用户不在白名单: ${username}`);
    }
    if (
      whiteList.length === 0 &&
      blackList.length > 0 &&
      blackList.includes(username)
    ) {
      throw new NotFoundException(`用户在黑名单: ${username}`);
    }

    // 文件树（缓存 10 分钟）
    let tree: TreeEntry[] | undefined = await this.cache.getTree(username);
    if (!tree || tree.length === 0) {
      const fetched = await this.gitea.getRepoTree(username);
      if (!fetched) {
        throw new NotFoundException(
          `仓库不存在或文件树不可用: ${username}/pages`,
        );
      }
      tree = fetched;
      await this.cache.setTree(username, tree);
      this.logger.debug(
        `文件树缓存已写入 user=${username} files=${tree.length}`,
      );
    }

    // CNAME 自定义域名（缓存 10 分钟）
    if (tree.some((item) => item.path === 'CNAME')) {
      let cname = await this.cache.getCname(username);
      if (cname === undefined) {
        const content = await this.gitea.getRawText(username, '/CNAME');
        if (content !== null && isDomain(content.trim())) {
          cname = content.trim();
          await this.cache.setCname(username, cname);
        }
      }
      if (cname !== undefined && host !== cname) {
        // 与原版一致：写死 http
        res.status(301).set('Location', `http://${cname}${url}`).send();
        return;
      }
    }

    const filePath = url === '/' ? '/index.html' : url;
    const firstSegment = filePath.split('/')[1];

    if (
      !RESERVED_FIRST_SEGMENTS.includes(firstSegment) &&
      tree.some(
        (item) => item.path === filePath.slice(1) && item.type !== 'tree',
      )
    ) {
      // 精确命中仓库文件
      if (await this.serveRepoFile(username, filePath, tree, req, res)) {
        return;
      }
      // 拉取失败 → 清缓存重试一轮（替代原版盲递归，attempt 防死循环）
      if (attempt >= 1) {
        throw new NotFoundException(`文件拉取失败（已重试）: ${filePath}`);
      }
      await this.cache.invalidateUser(username);
      await this.handle(req, res, attempt + 1);
      return;
    }

    // SPA：仓库有 .spa 与 index.html → 兜底到 index.html（200）
    if (
      tree.some((item) => item.path === '.spa' && item.type !== 'tree') &&
      tree.some((item) => item.path === 'index.html' && item.type !== 'tree')
    ) {
      await this.serveRepoFile(
        username,
        '/index.html',
        tree,
        req,
        res,
        CACHE_30D,
      );
      return;
    }

    // 仓库自定义 404.html：404 状态返回其内容
    if (tree.some((item) => item.path === '404.html' && item.type !== 'tree')) {
      const content = await this.gitea.getRawText(username, '/404.html');
      if (content !== null) {
        res.status(404).type('html').send(content);
        return;
      }
    }

    throw new NotFoundException(`文件不存在: ${filePath}`);
  }

  /** 代理仓库文件：ETag/304、MIME、30 天 Cache-Control、流式透传。返回 false 表示拉取失败 */
  private async serveRepoFile(
    username: string,
    filePath: string,
    tree: TreeEntry[],
    req: Request,
    res: Response,
    forcedMaxAge?: number,
  ): Promise<boolean> {
    const entry = tree.find((item) => item.path === filePath.slice(1));
    const etag = entry?.sha ? `"${entry.sha}"` : undefined;

    res.setHeader(
      'Content-Type',
      mime.getType(extname(filePath)) ?? 'text/plain',
    );
    const maxAge = forcedMaxAge ?? this.resolveMaxAge(filePath);
    if (maxAge > 0) {
      res.setHeader('Cache-Control', `max-age=${maxAge}`);
    }
    if (etag !== undefined) {
      res.setHeader('ETag', etag);
      // 条件请求：sha 未变直接 304，省掉一次文件下载
      if (req.headers['if-none-match'] === etag) {
        res.status(304).send();
        return true;
      }
    }
    // 注：不手动设 Content-Length——raw 端点对 LFS 等场景的实际字节数可能与 tree.size 不符，
    // 交给 Node 用 chunked 编码更稳健

    const raw = await this.gitea.getRawStream(username, filePath);
    if (raw === null) {
      return false;
    }
    res.status(200);
    raw.stream.pipe(res);
    return true;
  }

  /** 命中 cacheSuffixName 正则 → 30 天；原版兜底正则语义保留 */
  private resolveMaxAge(filePath: string): number {
    const { cacheSuffixName } = this.config.getAll();
    const ext = extname(filePath);
    if (cacheSuffixName !== false && cacheSuffixName.test(ext)) {
      return CACHE_30D;
    }
    if (cacheSuffixName !== false && FALLBACK_SUFFIX_RE.test(ext)) {
      return CACHE_30D;
    }
    return 0;
  }

  /**
   * 从 host 尾部剥掉 pagesDomainName（异步递归查 CNAME 记录）。
   * 与原版算法一致：endswith → 剥离；否则查 CNAME 记录递归。
   * 增强：DNS CNAME 记录不含端口，因此额外支持对 pagesDomainName 的无端口形式匹配
   * （原版在 pagesDomainName 带端口时 CNAME 自定义域名完全失效，属已知缺陷）。
   */
  private async removeLastOccurrence(
    a: string,
    b: string,
  ): Promise<string | false> {
    if (a.endsWith(b)) {
      return a.slice(0, a.length - b.length);
    }
    // CNAME 记录无端口：用 pagesDomainName 的 hostname 部分再匹配一次
    const colon = b.lastIndexOf(':');
    if (colon > 0 && /^\d+$/.test(b.slice(colon + 1))) {
      const hostOnly = b.slice(0, colon);
      if (a.endsWith(hostOnly)) {
        return a.slice(0, a.length - hostOnly.length);
      }
    }
    try {
      const records = await this.resolveCname(a);
      if (records.length > 0) {
        return this.removeLastOccurrence(records[0], b);
      }
    } catch {
      // DNS 查询失败按不匹配处理
    }
    return false;
  }
}

/** 域名合法性判断（与原版正则一致） */
function isDomain(str: string): boolean {
  return /^([0-9a-zA-Z-]{1,}\.)+([a-zA-Z]{2,})$/.test(str);
}

/** 主域名教程页（原版为 Vue 构建产物，此处内联等价内容） */
function renderIndexPage(pagesDomainName: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gitea Pages</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 16px;color:#24292f}
h1{font-size:28px}.step{margin:16px 0;padding:16px;border:1px solid #d0d7de;border-radius:8px}
code{background:#f6f8fa;padding:2px 6px;border-radius:4px}</style></head>
<body>
<h1>Gitea Pages</h1>
<p>三步启用你的静态站点：</p>
<div class="step"><strong>1.</strong> 在 Gitea 创建名为 <code>pages</code> 的公开仓库</div>
<div class="step"><strong>2.</strong> 把静态网站文件推送到 <code>main</code> 分支根目录</div>
<div class="step"><strong>3.</strong> 访问 <code>https://&lt;用户名&gt;.${pagesDomainName}</code> 即可</div>
<p>自定义域名：在仓库根目录放置 <code>CNAME</code> 文件（内容为你的域名），并把 DNS CNAME 记录指向 <code>&lt;用户名&gt;.${pagesDomainName}</code>。</p>
</body></html>`;
}

/** 本地默认 404 页 */
function renderNotFoundPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 - Gitea Pages</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 16px;color:#24292f;text-align:center}
h1{font-size:64px;margin-bottom:8px}</style></head>
<body>
<h1>404</h1>
<p>这里没有 Gitea Pages 站点。</p>
<p><small>${escapeHtml(message)}</small></p>
</body></html>`;
}

/** 服务器错误页 */
function renderErrorPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>500 - Gitea Pages</title></head>
<body><h1>500</h1><p>服务器内部错误。</p></body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export { renderNotFoundPage };
