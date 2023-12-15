const { existsSync, copyFileSync, mkdirSync } = require('fs');
const path = require('path');
const Application = require('thinkjs');

const instance = new Application({
  RUNTIME_PATH: path.join(process.cwd(), 'runtime'),
  ROOT_PATH: __dirname,
  APP_PATH: path.join(__dirname, 'app'),
  proxy: true, // use proxy
  env: 'pkg'
});

instance.run();

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
  if (!existsSync(configFile)) {
    copyFileSync(path.join(__dirname, './config.js'), configFile);
  }

  if (!existsSync(path.join(process.cwd(), './view'))) {
    mkdirSync(path.join(process.cwd(), 'view'));
  }

  if (!existsSync(path.join(process.cwd(), './view/404.html'))) {
    copyFileSync(path.join(__dirname, 'view/404.html'), path.join(process.cwd(), 'view/404.html'));
  }

  if (!existsSync(path.join(process.cwd(), './view/index.html'))) {
    copyFileSync(
      path.join(__dirname, 'view/index.html'),
      path.join(process.cwd(), 'view/index.html')
    );
  }

  const config = require(configFile);
  conf(config);
});
