import 'thinkjs3-ts';
import path from 'path';
import nunjucks from 'think-view-nunjucks';
import fileSession from 'think-session-file';
import fileCache from 'think-cache-file';
const { Console, File, DateFile } = require('think-logger3');
const isDev = think.env === 'development' || think.env === 'vercel';
const isVercel = think.env === 'vercel';
const isPkg = think.env === 'pkg';

export const cache = {
  type: 'file',
  common: {
    timeout: 24 * 60 * 60 * 1000 // millisecond
  },
  file: {
    handle: fileCache,
    // absoulte path is necessarily required
    cachePath: isVercel
      ? '/tmp/cache'
      : path.join(isPkg ? process.cwd() : think.ROOT_PATH, 'runtime/cache'),
    pathDepth: 1,
    gcInterval: 24 * 60 * 60 * 1000 // gc interval
  }
};

export const session = {
  type: 'file',
  common: {
    cookie: {
      name: 'gitea-pages'
      // keys: ['werwer', 'werwer'],
      // signed: true
    }
  },
  file: {
    handle: fileSession,
    sessionPath: isVercel
      ? '/tmp/session'
      : path.join(isPkg ? process.cwd() : think.ROOT_PATH, 'runtime/session')
  }
};

export const view = {
  type: 'nunjucks',
  common: {
    viewPath: path.join(isPkg ? process.cwd() : think.ROOT_PATH, 'view'),
    sep: '_',
    extname: '.html'
  },
  nunjucks: {
    handle: nunjucks
  }
};

export const logger = {
  type: isDev ? 'console' : 'dateFile',
  console: {
    handle: Console
  },
  file: {
    handle: File,
    backups: 10, // max chunk number
    absolute: true,
    maxLogSize: 50 * 1024, // 50M
    filename: path.join(isPkg ? process.cwd() : think.ROOT_PATH, 'logs/app.log')
  },
  dateFile: {
    handle: DateFile,
    level: 'ALL',
    absolute: true,
    pattern: '-yyyy-MM-dd',
    alwaysIncludePattern: true,
    filename: path.join(isPkg ? process.cwd() : think.ROOT_PATH, 'logs/app.log')
  }
};
