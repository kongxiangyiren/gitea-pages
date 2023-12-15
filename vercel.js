const path = require('path');
const Application = require('thinkjs');
const Loader = require('thinkjs/lib/loader');

class VercelLoader extends Loader {
  writeConfig() {

  }
}

const app = new Application({
  ROOT_PATH: __dirname,
  APP_PATH: path.join(__dirname, 'app'),
  VIEW_PATH: path.join(__dirname, 'view'),
  proxy: true, // use proxy
  env: 'vercel',
  external: {
    log4js: {
      stdout: path.join(__dirname, 'node_modules/log4js/lib/appenders/stdout.js'),
      console: path.join(__dirname, 'node_modules/log4js/lib/appenders/console.js')
    },
    static: {
      // www: path.join(__dirname, 'www')
    }
  }
});

const loader = new VercelLoader(app.options);
loader.loadAll('worker');
think.app.emit('appReady');

function conf(vax, fa) {
  for (var key in vax) {
    if (typeof vax[key] === 'object' && !Array.isArray(vax[key])) {
      if (fa !== undefined) {
        conf(vax[key], fa + '.' + key);
      } else {
        conf(vax[key], key);
      }
    } else {
      if (fa !== undefined) {
        think.config(fa + '.' + key, vax[key]);
      } else {
        think.config(key, vax[key]);
      }
    }
  }
}

think.beforeStartServer(() => {
  const configFile = path.join(process.cwd(), 'config.js');
  const config = require(configFile);
  conf(config);
});

module.exports = think.app.callback();
