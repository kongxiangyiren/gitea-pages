import 'thinkjs3-ts';
import path from 'path';
const isDev = think.env === 'development';
const isVercel = think.env === 'vercel';
const isPkg = think.env === 'pkg';
export = [
  {
    handle: 'meta',
    options: {
      logRequest: isDev,
      sendResponseTime: isDev
    }
  },
  {
    handle: 'resource',
    enable: false,
    options: {
      root: path.join(isPkg ? process.cwd() : think.ROOT_PATH, 'www'),
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
      uploadDir: isVercel ? '/tmp/_tmp' : path.join(think.RUNTIME_PATH, '_tmp'),
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
