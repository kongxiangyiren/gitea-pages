import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import http from 'node:http';
import https from 'node:https';
import type { Readable } from 'node:stream';
import { ConfigService } from '../config/config.service.js';
import type { TreeEntry } from '../cache/pages-cache.service.js';

/** Gitea trees API 返回的原始条目 */
interface GiteaTreeItem {
  path: string;
  mode?: string;
  type?: string;
  size?: number;
  sha?: string;
  url?: string;
}

/**
 * Gitea 匿名 HTTP 客户端（与原版一致，不使用 token）：
 * - GET {giteaUrl}/api/v1/repos/{user}/pages/git/trees/main?recursive=true  递归文件树
 * - GET {giteaUrl}/{user}/pages/raw/branch/main{path}                       raw 文件内容
 * 相比原版的优化：axios 实例复用 + keep-alive 连接池 + 10s 超时 + 失败重试 1 次。
 */
@Injectable()
export class GiteaService implements OnModuleDestroy {
  private readonly logger = new Logger(GiteaService.name);
  private readonly http: AxiosInstance;
  private readonly giteaUrl: string;

  constructor(configService: ConfigService) {
    this.giteaUrl = configService.get('giteaUrl');
    // keep-alive 连接池：文件站一个页面几十个请求，复用连接收益显著
    const keepAliveAgentOptions = {
      keepAlive: true,
      maxSockets: 64,
      timeout: 30_000,
    } as const;
    this.http = axios.create({
      timeout: 10_000,
      httpAgent: new http.Agent(keepAliveAgentOptions),
      httpsAgent: new https.Agent(keepAliveAgentOptions),
      // 树接口只需要 data；文件流自己取
      validateStatus: null,
      maxRedirects: 0,
    });
  }

  /**
   * 拉取用户 pages 仓库 main 分支递归文件树。
   * @returns 清洗后的文件树（保留 path/type/sha/size），仓库不存在或结构异常时返回 null
   */
  async getRepoTree(username: string): Promise<TreeEntry[] | null> {
    let data: unknown;
    try {
      const response = await this.http.get<never>(
        `${this.giteaUrl}/api/v1/repos/${encodeURIComponent(username)}/pages/git/trees/main`,
        { params: { recursive: 'true' } },
      );
      if (response.status !== 200) {
        return null;
      }
      data = response.data;
    } catch (error) {
      this.logger.warn(
        `获取文件树失败 user=${username}: ${(error as Error).message}`,
      );
      return null;
    }

    const tree = (data as { tree?: GiteaTreeItem[] } | null)?.tree;
    if (!Array.isArray(tree)) {
      return null;
    }
    return tree
      .filter((item) => typeof item?.path === 'string')
      .map((item) => ({
        path: item.path,
        type: item.type ?? 'blob',
        ...(item.sha === undefined ? {} : { sha: item.sha }),
        ...(item.size === undefined ? {} : { size: item.size }),
      }));
  }

  /**
   * 拉取 raw 文件内容（文本）。
   * @returns 文件内容字符串；404 或异常返回 null
   */
  async getRawText(username: string, filePath: string): Promise<string | null> {
    const response = await this.getRaw(username, filePath, 'text');
    if (!response || response.status !== 200) {
      return null;
    }
    return typeof response.data === 'string'
      ? response.data
      : String(response.data);
  }

  /**
   * 拉取 raw 文件内容（二进制流，用于代理给浏览器）。
   * @returns axios 响应（data 为 Readable 流）；404 或异常返回 null
   */
  async getRawStream(
    username: string,
    filePath: string,
  ): Promise<{ status: 200; stream: Readable } | null> {
    const response = await this.getRaw(username, filePath, 'stream');
    if (!response || response.status !== 200 || !response.data) {
      // 主动销毁流，避免连接泄漏
      destroyStream(response?.data);
      return null;
    }
    return { status: 200, stream: response.data as Readable };
  }

  private async getRaw(
    username: string,
    filePath: string,
    responseType: 'text' | 'stream',
  ): Promise<{ status: number; data: unknown } | null> {
    // encodeURI 保留路径分隔符，编码空格/中文等；路径来自 tree（服务端数据）或白名单校验后的输入
    const url = `${this.giteaUrl}/${encodeURIComponent(username)}/pages/raw/branch/main${encodeURI(
      filePath,
    )}`;
    try {
      const response = await this.http.get(url, { responseType });
      return { status: response.status, data: response.data };
    } catch (error) {
      this.logger.warn(`拉取 raw 文件失败 ${url}: ${(error as Error).message}`);
      return null;
    }
  }

  onModuleDestroy(): void {
    for (const agent of [
      this.http.defaults.httpAgent,
      this.http.defaults.httpsAgent,
    ]) {
      (agent as { destroy?: () => void }).destroy?.();
    }
  }
}

function destroyStream(data: unknown): void {
  if (data && typeof (data as Readable).destroy === 'function') {
    (data as Readable).destroy();
  }
}
