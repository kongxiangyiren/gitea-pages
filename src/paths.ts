import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSea } from 'node:sea';

/**
 * 项目根路径：固定为项目所在目录（package.json / config.js 所在处），
 * 由本模块位置推导——源码运行时在 <root>/src，编译后在 <root>/dist，
 * 各取上一级即为项目根。与进程启动时的工作目录（cwd）无关，
 * 从任意目录执行 `node dist/main.js` 行为一致。
 */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url)); // <root>/src 或 <root>/dist
export const ROOT_PATH = isSea()
  ? resolve(MODULE_DIR)
  : resolve(MODULE_DIR, '..');

/** 运行期产物目录（缓存等），默认 <ROOT_PATH>/runtime */
export const RUNTIME_PATH = resolve(ROOT_PATH, 'runtime');
