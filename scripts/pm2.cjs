/**
 * PM2 包装器：把 PM2_HOME 固定到项目内 .pm2，避免与全局 PM2（含其他项目的常驻应用）串台。
 * 用法：node scripts/pm2.cjs <pm2 子命令与参数>
 */
/* eslint-disable @typescript-eslint/no-require-imports -- 包装器需以 CommonJS 直接执行 */
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const home = path.join(__dirname, '..', '.pm2')
const args = process.argv.slice(2)
const env = { ...process.env, PM2_HOME: home }

// 统一走全局 pm2（Windows 下需经 cmd 解析 pm2.cmd）
const result =
  process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', ['pm2', ...args].join(' ')], {
        stdio: 'inherit',
        env,
      })
    : spawnSync('pm2', args, { stdio: 'inherit', env })

process.exit(result.status ?? 1)
