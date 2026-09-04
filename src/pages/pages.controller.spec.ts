import { describe, it, expect, vi } from 'vitest';
import { PagesController } from './pages.controller.js';
import { ConfigService } from '../config/config.service.js';
import {
  PagesCacheService,
  type TreeEntry,
} from '../cache/pages-cache.service.js';
import { GiteaService } from '../gitea/gitea.service.js';
import { CNAME_RESOLVER } from '../cache/cache.constants.js';
import type { Request, Response } from 'express';

/** mock Res 的类型：在 Response 之上补充测试需要断言的内部状态 */
type MockResponse = Response & {
  headers: Record<string, string>;
  body?: unknown;
};

/** 构造带常用属性的 mock Res */
function mockRes(): MockResponse {
  const res = {
    statusCode: 0,
    headers: {},
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    set(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    type(_value: string) {
      return res;
    },
    send(body?: unknown) {
      res.body = body;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  } as unknown as MockResponse;
  return res;
}

function mockReq(
  host: string,
  url: string,
  headers: Record<string, string> = {},
): Request {
  return { headers: { host, ...headers }, url } as unknown as Request;
}

const TREE: TreeEntry[] = [
  { path: 'index.html', type: 'blob', sha: 'sha-index', size: 11 },
  { path: 'assets/style.css', type: 'blob', sha: 'sha-css', size: 100 },
  { path: '404.html', type: 'blob', sha: 'sha-404', size: 5 },
  { path: 'docs', type: 'tree' },
];

function buildController(
  tree: TreeEntry[] | null = TREE,
  rawTextMap: Record<string, string> = {},
  overrides: Partial<Record<string, unknown>> = {},
): {
  controller: PagesController;
  gitea: GiteaService;
  cache: PagesCacheService;
} {
  const config = new ConfigService({
    port: 8360,
    pagesDomainName: 'pages.test:8360',
    giteaUrl: 'https://gitea.test',
    whiteList: [],
    blackList: [],
    cacheSuffixName: /.(gif|png|jpe?g|css|js|woff|woff2|ttf|webp|ico)$/i,
    gzip: { enable: true, threshold: 1024 },
    ...overrides,
  });
  const cache = {
    store: new Map<string, unknown>(),
    getTree: vi.fn(async () => undefined),
    setTree: vi.fn(async () => undefined),
    getCname: vi.fn(async () => undefined),
    setCname: vi.fn(async () => undefined),
    invalidateUser: vi.fn(async () => undefined),
  } as unknown as PagesCacheService;
  const gitea = {
    getRepoTree: vi.fn(async () => tree),
    getRawText: vi.fn(
      async (_u: string, path: string) => rawTextMap[path] ?? null,
    ),
    getRawStream: vi.fn(async () => ({
      status: 200 as const,
      stream: { pipe: () => {} },
    })),
  } as unknown as GiteaService;
  const controller = new PagesController(config, cache, gitea, async () => []);
  return { controller, gitea, cache };
}

describe('PagesController.host 解析', () => {
  it('主域名 + / 返回教程页 200', async () => {
    const { controller } = buildController();
    const res = mockRes();
    await controller['serve'](mockReq('pages.test:8360', '/'), res);
    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain('Gitea Pages');
  });

  it('主域名 + 子路径 404', async () => {
    const { controller } = buildController();
    const res = mockRes();
    await controller['serve'](mockReq('pages.test:8360', '/foo'), res);
    expect(res.statusCode).toBe(404);
  });

  it('host 不匹配 pagesDomainName 且无 CNAME 记录 → 404', async () => {
    const { controller } = buildController();
    const res = mockRes();
    await controller['serve'](mockReq('unknown.test', '/'), res);
    expect(res.statusCode).toBe(404);
  });

  it('多级子域名（>2 段）→ 404', async () => {
    const { controller } = buildController();
    const res = mockRes();
    await controller['serve'](mockReq('a.b.pages.test:8360', '/'), res);
    expect(res.statusCode).toBe(404);
  });

  it('用户名含非法字符 → 404', async () => {
    const { controller } = buildController();
    const res = mockRes();
    await controller['serve'](mockReq('ba d.pages.test:8360', '/'), res);
    expect(res.statusCode).toBe(404);
  });
});

describe('PagesController.白名单/黑名单', () => {
  it('白名单非空且用户不在其中 → 404', async () => {
    const { controller } = buildController(TREE, {}, { whiteList: ['alice'] });
    const res = mockRes();
    await controller['serve'](mockReq('bob.pages.test:8360', '/'), res);
    expect(res.statusCode).toBe(404);
  });

  it('白名单命中 → 正常服务', async () => {
    const { controller, gitea } = buildController(
      TREE,
      {},
      { whiteList: ['bob'] },
    );
    const res = mockRes();
    await controller['serve'](mockReq('bob.pages.test:8360', '/'), res);
    expect(res.statusCode).toBe(200);
    expect(gitea.getRepoTree).toHaveBeenCalledWith('bob');
  });

  it('白名单空、黑名单命中 → 404', async () => {
    const { controller } = buildController(TREE, {}, { blackList: ['bob'] });
    const res = mockRes();
    await controller['serve'](mockReq('bob.pages.test:8360', '/'), res);
    expect(res.statusCode).toBe(404);
  });
});

describe('PagesController.CNAME 自定义域名', () => {
  it('仓库有 CNAME 且 host 不一致 → 301 到 http://cname', async () => {
    const { controller } = buildController(
      [...TREE, { path: 'CNAME', type: 'blob' }],
      { '/CNAME': 'custom.example.com' },
    );
    const res = mockRes();
    await controller['serve'](
      mockReq('bob.pages.test:8360', '/index.html'),
      res,
    );
    expect(res.statusCode).toBe(301);
    expect(res.headers['location']).toBe(
      'http://custom.example.com/index.html',
    );
  });

  it('CNAME 内容不是合法域名 → 不重定向，继续文件服务', async () => {
    const { controller, gitea } = buildController(
      [...TREE, { path: 'CNAME', type: 'blob' }],
      { '/CNAME': 'not a domain' },
    );
    const res = mockRes();
    await controller['serve'](mockReq('bob.pages.test:8360', '/'), res);
    expect(res.statusCode).not.toBe(301);
    expect(gitea.getRawStream).toHaveBeenCalled();
  });
});

describe('PagesController.CNAME DNS 递归解析', () => {
  it('host 不匹配但 CNAME 记录指向 pagesDomainName → 正常解析出用户名', async () => {
    const config = new ConfigService({
      port: 8360,
      pagesDomainName: 'pages.test',
      giteaUrl: 'https://gitea.test',
      whiteList: [],
      blackList: [],
      cacheSuffixName: false,
      gzip: { enable: true, threshold: 1024 },
    });
    const cache = {
      getTree: vi.fn(async () => undefined),
      setTree: vi.fn(async () => undefined),
      getCname: vi.fn(async () => undefined),
      setCname: vi.fn(async () => undefined),
      invalidateUser: vi.fn(async () => undefined),
    } as unknown as PagesCacheService;
    const gitea = {
      getRepoTree: vi.fn(async () => TREE),
      getRawText: vi.fn(async () => null),
      getRawStream: vi.fn(async () => ({
        status: 200 as const,
        stream: { pipe: () => {} },
      })),
    } as unknown as GiteaService;
    // custom.example.com 的 CNAME 记录指向 bob.pages.test
    const controller = new PagesController(
      config,
      cache,
      gitea,
      async (host: string) =>
        host === 'custom.example.com' ? ['bob.pages.test'] : [],
    );
    const res = mockRes();
    await controller['serve'](mockReq('custom.example.com', '/'), res);
    expect(gitea.getRepoTree).toHaveBeenCalledWith('bob');
    expect(res.statusCode).toBe(200);
  });
});

describe('PagesController.SPA 与 404', () => {
  it('SPA 仓库：未命中路径兜底 index.html（200）', async () => {
    const spaTree: TreeEntry[] = [
      { path: 'index.html', type: 'blob', sha: 'sha-index' },
      { path: '.spa', type: 'blob' },
    ];
    const { controller } = buildController(spaTree);
    const res = mockRes();
    await controller['serve'](
      mockReq('bob.pages.test:8360', '/some/route'),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBe('"sha-index"');
  });

  it('仓库自定义 404.html：404 状态 + 其内容', async () => {
    const { controller } = buildController(TREE, {
      '/404.html': 'custom 404 body',
    });
    const res = mockRes();
    await controller['serve'](
      mockReq('bob.pages.test:8360', '/missing.png'),
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(String(res.body)).toContain('custom 404 body');
  });

  it('无 SPA 无自定义 404 → 默认 404 页', async () => {
    const { controller } = buildController([
      { path: 'index.html', type: 'blob' },
    ]);
    const res = mockRes();
    await controller['serve'](
      mockReq('bob.pages.test:8360', '/missing.png'),
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(String(res.body)).toContain('404');
  });

  it('CNAME/.github/404.html/.spa 首段不作普通文件服务', async () => {
    const reservedTree: TreeEntry[] = [
      { path: 'CNAME', type: 'blob', sha: 's1' },
      { path: '.github', type: 'blob', sha: 's2' },
      { path: 'index.html', type: 'blob' },
    ];
    const { controller, gitea } = buildController(reservedTree, {
      '/CNAME': 'real.example.com',
    });
    // host 与 CNAME 一致，不走 301；请求 /CNAME 本身 → 不作为普通文件，落到 SPA/index 兜底
    const res = mockRes();
    await controller['serve'](mockReq('real.example.com', '/CNAME'), res);
    expect(gitea.getRawStream).not.toHaveBeenCalledWith(
      expect.anything(),
      '/CNAME',
    );
  });
});

describe('PagesController.文件服务', () => {
  it('cacheSuffixName 命中 → Cache-Control 30 天', async () => {
    const { controller } = buildController();
    const res = mockRes();
    await controller['serve'](
      mockReq('bob.pages.test:8360', '/assets/style.css'),
      res,
    );
    expect((res.headers as Record<string, string>)['cache-control']).toBe(
      `max-age=${30 * 24 * 60 * 60}`,
    );
  });

  it('tree 类型条目不作为文件服务', async () => {
    const { controller, gitea } = buildController(TREE);
    const res = mockRes();
    await controller['serve'](mockReq('bob.pages.test:8360', '/docs'), res);
    expect(gitea.getRawStream).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it('根路径映射为 /index.html 服务', async () => {
    const { controller, gitea } = buildController(TREE);
    const res = mockRes();
    await controller['serve'](mockReq('bob.pages.test:8360', '/'), res);
    expect(gitea.getRawStream).toHaveBeenCalledWith('bob', '/index.html');
    expect(res.statusCode).toBe(200);
  });

  it('CNAME_RESOLVER token 导出可用（DI 绑定健全性）', () => {
    expect(CNAME_RESOLVER).toBeDefined();
  });
});
