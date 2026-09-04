import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ConfigService } from '../src/config/config.service.js';
import { PagesCacheService } from '../src/cache/pages-cache.service.js';
import { CNAME_RESOLVER } from '../src/cache/cache.constants.js';

/**
 * E2E：起一个 mock Gitea HTTP 服务器（同时模拟 API 与 raw 路由），
 * 应用配置指向它，用 supertest 以不同 Host 头请求完整应用。
 *
 * mock 仓库设定：
 * - alice/pages: index.html + assets/style.css + 404.html + CNAME(custom.example.com)
 * - bob/pages:   index.html + .spa（SPA 站点）
 * - ghost/pages: 404（仓库不存在）
 */

interface MockFile {
  body: string;
  type: string;
}

const ALICE_FILES: Record<string, MockFile> = {
  '/index.html': { body: '<h1>alice index</h1>', type: 'text/html' },
  '/assets/style.css': { body: 'body { color: red }', type: 'text/css' },
  '/404.html': { body: '<h1>alice 404</h1>', type: 'text/html' },
  '/CNAME': { body: 'custom.example.com', type: 'text/plain' },
};
const ALICE_TREE = [
  { path: 'index.html', type: 'blob', sha: 'sha-index', size: 17 },
  { path: 'assets/style.css', type: 'blob', sha: 'sha-css', size: 19 },
  { path: '404.html', type: 'blob', sha: 'sha-404', size: 16 },
  { path: 'CNAME', type: 'blob', sha: 'sha-cname', size: 18 },
];
const BOB_FILES: Record<string, MockFile> = {
  '/index.html': { body: '<h1>bob spa</h1>', type: 'text/html' },
  '/.spa': { body: '', type: 'text/plain' },
};
const BOB_TREE = [
  { path: 'index.html', type: 'blob', sha: 'sha-bob-index', size: 16 },
  { path: '.spa', type: 'blob', sha: 'sha-spa', size: 0 },
];

let mockGitea: Server;
let mockGiteaUrl: string;
let app: INestApplication;
let rawHits: string[] = [];
let treeHits = 0;

function giteaHandler(reqUrl: string): {
  status: number;
  body: string;
  type?: string;
} {
  if (
    reqUrl.includes('/api/v1/repos/') &&
    reqUrl.includes('/pages/git/trees/main')
  ) {
    treeHits += 1;
    const user = reqUrl.match(/\/api\/v1\/repos\/([^/]+)\//)?.[1] ?? '';
    if (user === 'ghost') {
      return { status: 404, body: 'not found' };
    }
    if (user === 'alice') {
      return {
        status: 200,
        body: JSON.stringify({ tree: ALICE_TREE }),
        type: 'application/json',
      };
    }
    if (user === 'bob') {
      return {
        status: 200,
        body: JSON.stringify({ tree: BOB_TREE }),
        type: 'application/json',
      };
    }
    // cachetest-* 用户：动态生成仓库（供缓存用例使用独享用户名，避免跨用例缓存污染）
    if (user.startsWith('cachetest-')) {
      return {
        status: 200,
        body: JSON.stringify({
          tree: [
            { path: 'index.html', type: 'blob', sha: `sha-${user}`, size: 5 },
          ],
        }),
        type: 'application/json',
      };
    }
    return { status: 404, body: 'no repo' };
  }
  // raw: /{user}/pages/raw/branch/main{path}
  const raw = reqUrl.match(/^\/([^/]+)\/pages\/raw\/branch\/main(\/.*)$/);
  if (raw) {
    rawHits.push(reqUrl);
    const [, user, path] = raw;
    if (user.startsWith('cachetest-') && path === '/index.html') {
      return { status: 200, body: 'cache', type: 'text/html' };
    }
    const files =
      user === 'alice' ? ALICE_FILES : user === 'bob' ? BOB_FILES : {};
    const file = files[path];
    if (file) {
      return { status: 200, body: file.body, type: file.type };
    }
  }
  return { status: 404, body: 'mock gitea: not found' };
}

beforeAll(async () => {
  mockGitea = createServer((req, res) => {
    const { status, body, type } = giteaHandler(req.url ?? '');
    res.writeHead(status, type ? { 'Content-Type': type } : {});
    res.end(body);
  });
  await new Promise<void>((resolve) =>
    mockGitea.listen(0, '127.0.0.1', resolve),
  );
  const address = mockGitea.address();
  if (typeof address === 'object' && address) {
    mockGiteaUrl = `http://127.0.0.1:${address.port}`;
  }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService({
        port: 0,
        pagesDomainName: 'pages.test:0',
        giteaUrl: mockGiteaUrl,
        whiteList: [],
        blackList: [],
        cacheSuffixName: /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i,
        gzip: { enable: false, threshold: 1024 },
      }),
    )
    .overrideProvider(CNAME_RESOLVER)
    .useValue(async (host: string) =>
      host === 'bob-alias.example.com' || host === 'custom.example.com'
        ? [
            host === 'custom.example.com'
              ? 'alice.pages.test'
              : 'bob.pages.test',
          ]
        : [],
    )
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  app.set('trust proxy', true);
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await new Promise<void>((resolve) => mockGitea.close(() => resolve()));
});

describe('Gitea Pages E2E (mock Gitea)', () => {
  beforeEach(() => {
    rawHits = [];
    treeHits = 0;
  });

  it('GET /healthz 返回 ok', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', giteaUrl: mockGiteaUrl });
  });

  it('主域名根路径返回教程页', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Host', 'pages.test:0');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Gitea Pages');
    expect(res.headers['x-powered-by']).toBe('gitea-pages');
  });

  it('主域名子路径 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/nope')
      .set('Host', 'pages.test:0');
    expect(res.status).toBe(404);
  });

  it('未知域名 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Host', 'elsewhere.test');
    expect(res.status).toBe(404);
  });

  it('用户站点根路径 → index.html 内容 + Content-Type + ETag', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Host', 'bob.pages.test:0');
    expect(res.status).toBe(200);
    expect(res.text).toBe('<h1>bob spa</h1>');
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['etag']).toBe('"sha-bob-index"');
    expect(res.headers['x-powered-by']).toBe('gitea-pages');
  });

  it('静态 css 文件：MIME + Cache-Control 30 天', async () => {
    const res = await request(app.getHttpServer())
      .get('/assets/style.css')
      .set('Host', 'custom.example.com');
    expect(res.status).toBe(200);
    expect(res.text).toBe('body { color: red }');
    expect(res.headers['content-type']).toContain('text/css');
    expect(res.headers['cache-control']).toBe(`max-age=${30 * 24 * 60 * 60}`);
  });

  it('If-None-Match 命中 ETag → 304 且不再访问 raw', async () => {
    await request(app.getHttpServer())
      .get('/assets/style.css')
      .set('Host', 'custom.example.com');
    const rawBefore = rawHits.length;
    const res = await request(app.getHttpServer())
      .get('/assets/style.css')
      .set('Host', 'custom.example.com')
      .set('If-None-Match', '"sha-css"');
    expect(res.status).toBe(304);
    expect(rawHits.length).toBe(rawBefore);
  });

  it('仓库不存在（ghost）→ 404 页', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Host', 'ghost.pages.test:0');
    expect(res.status).toBe(404);
    expect(res.text).toContain('404');
  });

  it('CNAME DNS 解析：别名经 DNS CNAME 记录指向 bob（无仓库级 CNAME 干扰）', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Host', 'bob-alias.example.com');
    expect(res.status).toBe(200);
    expect(res.text).toBe('<h1>bob spa</h1>');
  });

  it('CNAME 仓库经自定义域名访问（host === CNAME）→ 正常服务', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Host', 'custom.example.com');
    expect(res.status).toBe(200);
    expect(res.text).toBe('<h1>alice index</h1>');
  });

  it('CNAME 仓库经 pages 域名访问 → 301 到 http://custom.example.com', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Host', 'alice.pages.test:0');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('http://custom.example.com/');
  });

  it('SPA 仓库：未命中路径兜底 index.html（200）', async () => {
    const res = await request(app.getHttpServer())
      .get('/some/client/route')
      .set('Host', 'bob.pages.test:0');
    expect(res.status).toBe(200);
    expect(res.text).toBe('<h1>bob spa</h1>');
  });

  it('非 SPA 仓库经 CNAME 域名访问：未命中路径 → 自定义 404.html（404）', async () => {
    const res = await request(app.getHttpServer())
      .get('/missing-page.js')
      .set('Host', 'custom.example.com');
    expect(res.status).toBe(404);
    expect(res.text).toBe('<h1>alice 404</h1>');
  });

  it('x-request-id 中间件生效', async () => {
    const res = await request(app.getHttpServer())
      .get('/healthz')
      .set('X-Request-Id', 'test-id-123');
    expect(res.headers['x-request-id']).toBe('test-id-123');
  });

  it('缓存生效：第二次请求不再打 Gitea 树接口', async () => {
    // 用独享用户名避免命中前面用例写入的缓存（app 与 Keyv 实例跨用例共享）
    const unique = `cachetest-${Date.now()}`;
    await request(app.getHttpServer())
      .get('/')
      .set('Host', `${unique}.pages.test:0`);
    const treeAfterFirst = treeHits;
    expect(treeAfterFirst).toBeGreaterThan(0);
    await request(app.getHttpServer())
      .get('/')
      .set('Host', `${unique}.pages.test:0`);
    expect(treeHits).toBe(treeAfterFirst);
  });

  it('PagesCacheService 键语义（tree/cname/invalidate）', async () => {
    const cache = app.get(PagesCacheService, { strict: false });
    await cache.setTree('u1', [{ path: 'a.txt', type: 'blob' }]);
    expect(await cache.getTree('u1')).toEqual([
      { path: 'a.txt', type: 'blob' },
    ]);
    await cache.setCname('u1', 'x.example.com');
    expect(await cache.getCname('u1')).toBe('x.example.com');
    await cache.invalidateUser('u1');
    expect(await cache.getTree('u1')).toBeUndefined();
    expect(await cache.getCname('u1')).toBeUndefined();
  });
});
