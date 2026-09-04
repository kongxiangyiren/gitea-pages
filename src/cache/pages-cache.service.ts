import { Inject, Injectable } from '@nestjs/common';
import type { Keyv } from 'keyv';
import { PAGE_CACHE } from './cache.constants.js';

/** 文件树条目（保留 sha/size 供 ETag 与 Content-Length 使用，比原版多保留两个字段） */
export interface TreeEntry {
  path: string;
  type: string;
  sha?: string;
  size?: number;
}

/** 与原 ThinkJS 版一致的缓存键与 TTL 语义封装 */
@Injectable()
export class PagesCacheService {
  private static readonly TREE_TTL_MS = 10 * 60 * 1000;
  private static readonly CNAME_TTL_MS = 10 * 60 * 1000;

  constructor(@Inject(PAGE_CACHE) private readonly cache: Keyv) {}

  async getTree(username: string): Promise<TreeEntry[] | undefined> {
    return (await this.cache.get<TreeEntry[]>(`tree:${username}`)) ?? undefined;
  }

  async setTree(username: string, tree: TreeEntry[]): Promise<void> {
    await this.cache.set(
      `tree:${username}`,
      tree,
      PagesCacheService.TREE_TTL_MS,
    );
  }

  async getCname(username: string): Promise<string | undefined> {
    return (await this.cache.get<string>(`cname:${username}`)) ?? undefined;
  }

  async setCname(username: string, cname: string): Promise<void> {
    await this.cache.set(
      `cname:${username}`,
      cname,
      PagesCacheService.CNAME_TTL_MS,
    );
  }

  /** 文件拉取 404 时清空该用户全部缓存（树 + CNAME），下轮重新拉取 */
  async invalidateUser(username: string): Promise<void> {
    await this.cache.delete(`tree:${username}`);
    await this.cache.delete(`cname:${username}`);
  }
}
