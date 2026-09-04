import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import type { PagesConfig, ResolvedConfig } from './config.types.js';
import { CONFIG_DEFAULTS } from './config.types.js';
import { ROOT_PATH } from '../paths.js';

const HOSTNAME_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:\d+)?$/;

/** 跨 realm 安全的 RegExp 判断（vm 沙箱中的 RegExp 原型与主 realm 不同） */
function isRegExp(value: unknown): value is RegExp {
  return Object.prototype.toString.call(value) === '[object RegExp]';
}

/**
 * 校验外部 config.js 的关键配置，不合法直接抛错（启动即失败，避免带病运行）。
 * @throws Error 当配置不合法时
 */
export function validateConfig(config: PagesConfig): void {
  const problems: string[] = [];
  const { pagesDomainName, giteaUrl, whiteList, blackList, cacheSuffixName } =
    config;

  if (typeof pagesDomainName !== 'string' || pagesDomainName.trim() === '') {
    problems.push(
      'config.pagesDomainName 必须是非空字符串（可含端口，结尾无 /）',
    );
  } else if (!HOSTNAME_RE.test(pagesDomainName)) {
    problems.push(`config.pagesDomainName 格式不合法: "${pagesDomainName}"`);
  }

  if (typeof giteaUrl !== 'string' || giteaUrl.trim() === '') {
    problems.push('config.giteaUrl 必须是非空字符串（结尾无 /）');
  } else if (giteaUrl.endsWith('/')) {
    problems.push('config.giteaUrl 结尾不能带 /');
  }

  for (const [key, value] of [
    ['whiteList', whiteList],
    ['blackList', blackList],
  ] as const) {
    if (value !== undefined && !Array.isArray(value)) {
      problems.push(`config.${key} 必须是字符串数组`);
    }
  }

  if (
    cacheSuffixName !== undefined &&
    cacheSuffixName !== false &&
    !isRegExp(cacheSuffixName)
  ) {
    problems.push('config.cacheSuffixName 必须是 RegExp 或 false');
  }

  if (problems.length > 0) {
    throw new Error(`外部配置校验失败:\n  - ${problems.join('\n  - ')}`);
  }
}

/**
 * 合并外部配置与默认值（不读环境变量，env 仅用于 PORT，见 main.ts）。
 */
export function mergeConfig(partial: PagesConfig): ResolvedConfig {
  return {
    port: partial.port ?? CONFIG_DEFAULTS.port,
    pagesDomainName: partial.pagesDomainName ?? CONFIG_DEFAULTS.pagesDomainName,
    giteaUrl: partial.giteaUrl ?? CONFIG_DEFAULTS.giteaUrl,
    whiteList: partial.whiteList ?? CONFIG_DEFAULTS.whiteList,
    blackList: partial.blackList ?? CONFIG_DEFAULTS.blackList,
    cacheSuffixName:
      partial.cacheSuffixName === undefined
        ? CONFIG_DEFAULTS.cacheSuffixName
        : partial.cacheSuffixName,
    gzip: {
      enable: partial.gzip?.enable ?? CONFIG_DEFAULTS.gzip.enable,
      threshold: partial.gzip?.threshold ?? CONFIG_DEFAULTS.gzip.threshold,
    },
    ...(partial.cache === undefined ? {} : { cache: partial.cache }),
  };
}

/**
 * 从指定目录读取 config.js（CJS module.exports），不存在时用默认值。
 * @param dir 配置文件所在目录，默认 ROOT_PATH（固定为项目根目录，与进程 cwd 无关）
 * @throws 配置文件语法错误或校验失败时抛错
 */
export function loadConfig(dir: string = ROOT_PATH): ResolvedConfig {
  const file = join(resolve(dir), 'config.js');
  let raw: string;

  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    // 无外部配置：全默认
    return mergeConfig({} as PagesConfig);
  }

  let partial: PagesConfig;
  try {
    // 项目为 ESM（package.json type: module），外部 config.js 是用户手写的 CJS 文件
    // （module.exports = {...}，与原 ThinkJS 版格式一致），用 node:vm 以 CJS 语义求值
    const sandboxModule = { exports: {} as unknown };
    vm.runInNewContext(raw, {
      module: sandboxModule,
      exports: sandboxModule.exports,
    });
    partial = sandboxModule.exports as PagesConfig;
  } catch (error) {
    throw new Error(`读取外部配置 ${file} 失败: ${(error as Error).message}`);
  }

  if (typeof partial !== 'object' || partial === null) {
    throw new Error(`外部配置 ${file} 必须导出对象（module.exports = {...}）`);
  }

  validateConfig(partial);
  return mergeConfig(partial);
}

/** 同步读取并解析 config.js，供 main.ts 启动时使用 */
export function loadConfigSync(dir: string = ROOT_PATH): ResolvedConfig {
  return loadConfig(dir);
}
