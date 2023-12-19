import { fileURLToPath, URL } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import importToCDN, { autoComplete } from 'vite-plugin-cdn-import';
import simpleHtmlPlugin from 'vite-plugin-simple-html';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // cdn
    // @ts-expect-error
    importToCDN.default({
      prodUrl: 'https://registry.npmmirror.com/{name}/{version}/files/{path}',
      modules: [
        // vue
        autoComplete('vue')
      ]
    }),
    simpleHtmlPlugin({
      minify: true,
      inject: {
        data: {
          favicon:
            'data:image/svg+xml;base64,' +
            readFileSync(join(__dirname, './src/assets/gitea.svg'), 'base64')
        }
      }
    }),
    viteSingleFile()
  ],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    reportCompressedSize: false,

    rollupOptions: {
      //自定义底层的 Rollup 打包配置
      input: {
        index: join(__dirname, './index.html'),
        NotFound: join(__dirname, './404.html')
      }
    }
  }
});
