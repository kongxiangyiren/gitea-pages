import 'thinkjs3-ts';
import { join } from 'path';
import compress from 'koa-compress';
import { constants } from 'zlib';
import { existsSync } from 'fs';
const isDev = think.env === 'development';
const isVercel = think.env === 'vercel';
const isPkg = think.env === 'pkg';

let config;

if (!isDev && existsSync(join(process.cwd(), 'config.js'))) {
  config = require(join(process.cwd(), 'config.js'));
}

export = [
  {
    handle: 'meta',
    options: {
      logRequest: isDev,
      sendResponseTime: isDev
    }
  },
  {
    handle: compress,
    enable: (config && config.gzip && config.gzip.enable) ?? true,
    options: {
      threshold:
        config && config.gzip && config.gzip.threshold && !isNaN(Number(config.gzip.threshold))
          ? Number(config.gzip.threshold)
          : 1024,
      gzip: {
        flush: constants.Z_SYNC_FLUSH
      },
      deflate: {
        flush: constants.Z_SYNC_FLUSH
      },
      br: false // disable brotli
    } as compress.CompressOptions
  },
  {
    handle: 'resource',
    enable: false,
    options: {
      root: join(isPkg ? process.cwd() : think.ROOT_PATH, 'www'),
      publicPath: /^\/(static|favicon\.ico)/,
      notFoundNext: true
    }
  },
  {
    handle: 'trace',
    enable: false,
    options: {
      debug: isDev,
      sourceMap: false
    }
  },
  {
    handle: 'payload',
    options: {
      uploadDir: isVercel ? '/tmp/_tmp' : join(think.RUNTIME_PATH, '_tmp'),
      keepExtensions: true,
      limit: '5mb'
    }
  },
  {
    handle: 'router',
    options: {}
  },
  'logic',
  'controller'
];
