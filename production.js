const path = require('path');
const Application = require('thinkjs');

const instance = new Application({
  ROOT_PATH: __dirname,
  APP_PATH: path.join(__dirname, 'app'),
  proxy: true, // use proxy
  env: 'production'
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
  const config = require(configFile);
  conf(config);
});
