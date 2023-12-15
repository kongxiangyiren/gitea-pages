import fs from 'fs';
import { execSync } from 'child_process';
import pac from './package.json'assert {type:"json"}
function build() {
  // 判断dist文件夹是否存在
  if (fs.existsSync('./dist')) {
    // 删除dist文件夹
    fs.rmSync('./dist', { recursive: true });
  }

  // 判断app文件夹是否存在
  if (fs.existsSync('./app')) {
    // 删除app文件夹
    fs.rmSync('./app', { recursive: true });
  }

  // 编译
  execSync('npm run format && npx tslint "src/**/*.ts" --fix && npx tsc', {
    stdio: 'inherit'
  });

  // 复制
  fs.cpSync('./pack', './dist/pack', { recursive: true });
  fs.cpSync('./app', './dist/app', { recursive: true });
  // fs.cpSync('./package.json', './dist/package.json', { recursive: true });
  fs.cpSync('./config.js', './dist/config.js', { recursive: true });
  fs.cpSync('./view', './dist/view', { recursive: true });
  if (fs.existsSync('./www'))
    fs.cpSync('./www', './dist/www', { recursive: true });
  fs.cpSync('./production.js', './dist/production.js', { recursive: true });
  fs.cpSync('./pm2.json', './dist/pm2.json');

  delete pac.devDependencies
  pac.scripts={"start":"node ./production.js"}
  fs.writeFileSync("./dist/package.json",JSON.stringify(pac,null,2))
}

build();
