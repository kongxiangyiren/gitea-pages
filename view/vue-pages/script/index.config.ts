import { join } from 'path'
import { defineConfig } from 'vite'
import config from '../vite.config'

// https://vitejs.dev/config/
export default defineConfig({
  ...config,
  build: {
    outDir: '../',
    reportCompressedSize: false,
    copyPublicDir: false,
    emptyOutDir: false,
    rollupOptions: {
      //自定义底层的 Rollup 打包配置
      input: join(__dirname, '../index.html')
    }
  }
})
