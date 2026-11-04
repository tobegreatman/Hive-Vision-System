/* eslint-disable @typescript-eslint/no-require-imports -- pm2 配置必须使用 CommonJS */
const path = require('node:path')

const ROOT = __dirname

/**
 * pm2 常驻配置：web(8080) / api(3600) / stockframe(8770)。
 * 通过 `pnpm pm2:start` 启动，脚本会先构建 contracts 再拉起本配置。
 */
module.exports = {
  apps: [
    {
      name: 'platform-web',
      script: path.join(ROOT, 'node_modules/vite/bin/vite.js'),
      args: '--port 8080 --strictPort',
      cwd: ROOT,
      env: { NODE_ENV: 'development' },
      autorestart: true,
      time: true,
    },
    {
      name: 'platform-api',
      script: path.join(ROOT, 'server/node_modules/tsx/dist/cli.mjs'),
      args: 'src/index.ts',
      cwd: path.join(ROOT, 'server'),
      env: { NODE_ENV: 'development', PORT: '3600', HOST: '127.0.0.1' },
      autorestart: true,
      time: true,
    },
    {
      name: 'platform-stockframe',
      script: path.join(ROOT, 'tools/stockframe/tools/service/start.pyw'),
      interpreter: 'python',
      cwd: ROOT,
      // start.pyw 在端口已被占用时以 0 退出，交给 pm2 视为正常结束而不是反复重启
      stop_exit_codes: [0],
      autorestart: true,
      time: true,
    },
  ],
}
