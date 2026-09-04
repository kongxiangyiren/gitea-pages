import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: false,
  entry: 'src/main.ts',
  format: ['esm'],
  deps: {
    onlyBundle: false,
    // // 打包所有依赖，全部内联进单个输出文件
    alwaysBundle: [/.*/],
    // NestJS 可选依赖（未安装），显式标记为 external，
    // 避免 rolldown 解析失败产生 "Module not found" 警告
    neverBundle: [
      /^@nestjs\/microservices/,
      /^@nestjs\/websockets/,
      'class-transformer',
      'class-validator',
    ],
  },
  exports: false,
  // ...config options
  platform: 'node',
  // 禁用压缩, 压缩会导致字段改变
  minify: false,
  shims: true,
  outputOptions: {
    // 将动态 import() 的 chunk 也内联进主文件，保证只输出单个文件
    codeSplitting: false,
    // 移除所有注释
    comments: false,
  },

  exe: {
    // 需要 Node.js >= 25.7.0 才能启用
    enabled: !!process.env.TS_EXE,
    fileName: 'gitea-pages',
    outDir: 'build',
    targets: [
      { platform: 'linux', arch: 'x64', nodeVersion: '26.8.1' },
      { platform: 'darwin', arch: 'arm64', nodeVersion: '26.8.1' },
      { platform: 'darwin', arch: 'x64', nodeVersion: '26.8.1' },
      { platform: 'win', arch: 'x64', nodeVersion: '26.8.1' },
    ],
  },
});
