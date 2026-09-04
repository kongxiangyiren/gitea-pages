import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, validateConfig, mergeConfig } from './config.loader.js';
import { CONFIG_DEFAULTS } from './config.types.js';

describe('config.loader', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gitea-pages-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('无 config.js 时返回默认值', () => {
    const config = loadConfig(dir);
    expect(config.pagesDomainName).toBe(CONFIG_DEFAULTS.pagesDomainName);
    expect(config.giteaUrl).toBe(CONFIG_DEFAULTS.giteaUrl);
    expect(config.port).toBe(8360);
    expect(config.whiteList).toEqual([]);
    expect(config.gzip.enable).toBe(true);
  });

  it('读取外部 config.js 并合并', () => {
    writeFileSync(
      join(dir, 'config.js'),
      `module.exports = {
        port: 9999,
        pagesDomainName: 'pages.example.com',
        giteaUrl: 'https://gitea.example.com',
        whiteList: ['alice'],
        cacheSuffixName: /\\.css$/,
      };`,
    );
    const config = loadConfig(dir);
    expect(config.port).toBe(9999);
    expect(config.pagesDomainName).toBe('pages.example.com');
    expect(config.giteaUrl).toBe('https://gitea.example.com');
    expect(config.whiteList).toEqual(['alice']);
    expect(config.blackList).toEqual([]);
    expect(config.cacheSuffixName).toEqual(/\.css$/);
    // 未覆盖的 gzip 用默认值
    expect(config.gzip).toEqual({ enable: true, threshold: 1024 });
  });

  it('giteaUrl 结尾带 / 时校验失败', () => {
    writeFileSync(
      join(dir, 'config.js'),
      `module.exports = { pagesDomainName: 'x.com', giteaUrl: 'https://gitea.com/' };`,
    );
    expect(() => loadConfig(dir)).toThrow(/结尾不能带/);
  });

  it('pagesDomainName 缺失时校验失败', () => {
    writeFileSync(
      join(dir, 'config.js'),
      `module.exports = { giteaUrl: 'https://gitea.com' };`,
    );
    expect(() => loadConfig(dir)).toThrow(/pagesDomainName/);
  });

  it('whiteList 非数组时校验失败', () => {
    writeFileSync(
      join(dir, 'config.js'),
      `module.exports = { pagesDomainName: 'x.com', giteaUrl: 'https://gitea.com', whiteList: 'bob' };`,
    );
    expect(() => loadConfig(dir)).toThrow(/whiteList/);
  });

  it('cacheSuffixName 类型错误时校验失败', () => {
    writeFileSync(
      join(dir, 'config.js'),
      `module.exports = { pagesDomainName: 'x.com', giteaUrl: 'https://gitea.com', cacheSuffixName: 'css' };`,
    );
    expect(() => loadConfig(dir)).toThrow(/cacheSuffixName/);
  });

  it('config.js 语法错误时抛出可读错误', () => {
    writeFileSync(
      join(dir, 'config.js'),
      `module.exports = { pagesDomainName: !!! };`,
    );
    expect(() => loadConfig(dir)).toThrow(/读取外部配置/);
  });

  describe('validateConfig 直接校验', () => {
    const base = { pagesDomainName: 'x.com', giteaUrl: 'https://gitea.com' };

    it('合法域名（含端口）通过', () => {
      expect(() =>
        validateConfig({ ...base, pagesDomainName: 'localhost:8360' }),
      ).not.toThrow();
    });

    it('域名格式不合法报错', () => {
      expect(() =>
        validateConfig({ ...base, pagesDomainName: 'bad host' }),
      ).toThrow(/格式不合法/);
    });
  });

  describe('mergeConfig', () => {
    it('部分字段回退默认值', () => {
      const merged = mergeConfig({
        pagesDomainName: 'a.com',
        giteaUrl: 'https://g',
      });
      expect(merged.port).toBe(8360);
      expect(merged.cacheSuffixName).toBe(CONFIG_DEFAULTS.cacheSuffixName);
      expect(merged.gzip.threshold).toBe(1024);
    });
  });
});
