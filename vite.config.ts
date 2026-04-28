import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { execSync } from 'child_process'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// ============ IP 封禁管理器 ============
interface IpRecord {
  attempts: number
  bannedUntil: number | null
}

const ipRecords = new Map<string, IpRecord>()

function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for']
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function isIpBanned(ip: string, maxAttempts: number, banMinutes: number): { banned: boolean; remainingAttempts: number } {
  const now = Date.now()
  const record = ipRecords.get(ip)

  if (!record) {
    return { banned: false, remainingAttempts: maxAttempts }
  }

  if (record.bannedUntil && now < record.bannedUntil) {
    return { banned: true, remainingAttempts: 0 }
  }

  if (record.bannedUntil && now >= record.bannedUntil) {
    // 封禁已过期，重置
    ipRecords.delete(ip)
    return { banned: false, remainingAttempts: maxAttempts }
  }

  const remainingAttempts = Math.max(0, maxAttempts - record.attempts)
  return { banned: false, remainingAttempts }
}

function recordFailedAttempt(ip: string, maxAttempts: number, banMinutes: number): { banned: boolean; remainingAttempts: number } {
  const now = Date.now()
  let record = ipRecords.get(ip)

  if (!record) {
    record = { attempts: 0, bannedUntil: null }
    ipRecords.set(ip, record)
  }

  record.attempts += 1

  if (record.attempts >= maxAttempts) {
    record.bannedUntil = now + banMinutes * 60 * 1000
    return { banned: true, remainingAttempts: 0 }
  }

  return { banned: false, remainingAttempts: maxAttempts - record.attempts }
}

function clearIpRecord(ip: string) {
  ipRecords.delete(ip)
}

// 定期清理过期的封禁记录（每 10 分钟）
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of ipRecords.entries()) {
    if (record.bannedUntil && now >= record.bannedUntil) {
      ipRecords.delete(ip)
    }
  }
}, 10 * 60 * 1000)

// ============ 认证辅助函数 ============
function readSettings(): any {
  const settingsPath = path.resolve(__dirname, 'data', 'settings.json')
  if (fs.existsSync(settingsPath)) {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  }
  return {}
}

function readNotes(): any[] {
  const notesPath = path.resolve(__dirname, 'data', 'notes.json')
  if (fs.existsSync(notesPath)) {
    return JSON.parse(fs.readFileSync(notesPath, 'utf-8'))
  }
  return []
}

// 环境变量已通过 loadEnv 传入 miNoteDataPlugin，直接使用 ADMIN_PASSWORD / MAX_ATTEMPTS / BAN_MINUTES

function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: any, data: any, statusCode = 200) {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = statusCode
  res.end(JSON.stringify(data))
}

function miNoteDataPlugin(env: Record<string, string>) {
  const DATA_DIR = path.resolve(__dirname, 'data')
  const IMAGES_DIR = path.join(DATA_DIR, 'xiaomi-images')

  // 从 loadEnv 加载的环境变量
  const ADMIN_PASSWORD = env.VITE_ADMIN_PASSWORD || ''
  const MAX_ATTEMPTS = env.VITE_ADMIN_MAX_ATTEMPTS ? parseInt(env.VITE_ADMIN_MAX_ATTEMPTS, 10) : 5
  const BAN_MINUTES = env.VITE_ADMIN_BAN_MINUTES ? parseInt(env.VITE_ADMIN_BAN_MINUTES, 10) : 30

  return {
    name: 'mi-note-data',
    configureServer(server: any) {
      // 提供 data/notes.json
      server.middlewares.use('/data/notes.json', (req: any, res: any, next: any) => {
        const filePath = path.join(DATA_DIR, 'notes.json')
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-cache')
          fs.createReadStream(filePath).pipe(res)
        } else {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'notes.json not found, please run sync first' }))
        }
      })

      // 提供 data/settings.json
      server.middlewares.use('/data/settings.json', (req: any, res: any, next: any) => {
        const filePath = path.join(DATA_DIR, 'settings.json')
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-cache')
          fs.createReadStream(filePath).pipe(res)
        } else {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'settings.json not found' }))
        }
      })

      // 提供设置保存端点 /api/settings
      server.middlewares.use('/api/settings', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        res.setHeader('Content-Type', 'application/json')

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const data = JSON.parse(body)
            const settingsPath = path.resolve(__dirname, 'data', 'settings.json')
            let settings: any = {}
            if (fs.existsSync(settingsPath)) {
              settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
            }
            Object.assign(settings, data)
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
            res.end(JSON.stringify({ success: true }))
          } catch (error: any) {
            console.error('保存设置失败:', error.message)
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: error.message }))
          }
        })
      })

      // 提供同步触发端点 /api/sync
      server.middlewares.use('/api/sync', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        res.setHeader('Content-Type', 'application/json')

        try {
          const output = execSync('pnpm sync', {
            cwd: __dirname,
            encoding: 'utf-8',
            timeout: 300000,
            stdio: 'pipe',
          })
          console.log(output)
          res.end(JSON.stringify({ success: true, message: '同步完成' }))
        } catch (error: any) {
          console.error('同步失败:', error.stderr || error.message)
          res.statusCode = 500
          res.end(JSON.stringify({
            success: false,
            error: error.stderr || error.message || '同步失败'
          }))
        }
      })

      // ============ 认证端点 ============

      // 验证访问密码
      server.middlewares.use('/api/auth/verify-access', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') {
          sendJson(res, { success: false, error: 'Method Not Allowed' }, 405)
          return
        }
        try {
          const data = await parseBody(req)
          const settings = readSettings()
          if (!settings.password) {
            sendJson(res, { success: true })
            return
          }
          if (data.password === settings.password) {
            sendJson(res, { success: true })
          } else {
            sendJson(res, { success: false, error: '密码错误' })
          }
        } catch (e: any) {
          sendJson(res, { success: false, error: e.message }, 500)
        }
      })

      // 验证分类密码
      server.middlewares.use('/api/auth/verify-folder', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') {
          sendJson(res, { success: false, error: 'Method Not Allowed' }, 405)
          return
        }
        try {
          const data = await parseBody(req)
          const settings = readSettings()
          const expected = settings.folderPasswords?.[data.folder]
          if (!expected) {
            sendJson(res, { success: true })
            return
          }
          if (data.password === expected) {
            sendJson(res, { success: true })
          } else {
            sendJson(res, { success: false, error: '密码错误' })
          }
        } catch (e: any) {
          sendJson(res, { success: false, error: e.message }, 500)
        }
      })

      // 验证笔记密码
      server.middlewares.use('/api/auth/verify-note', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') {
          sendJson(res, { success: false, error: 'Method Not Allowed' }, 405)
          return
        }
        try {
          const data = await parseBody(req)
          const notes = readNotes()
          const note = notes.find((n: any) => n.id === data.noteId)
          if (!note || !note.password) {
            sendJson(res, { success: true })
            return
          }
          if (data.password === note.password) {
            sendJson(res, { success: true })
          } else {
            sendJson(res, { success: false, error: '密码错误' })
          }
        } catch (e: any) {
          sendJson(res, { success: false, error: e.message }, 500)
        }
      })

      // 验证管理员密码（带失败次数限制 + IP 封禁）
      server.middlewares.use('/api/auth/verify-admin', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') {
          sendJson(res, { success: false, error: 'Method Not Allowed' }, 405)
          return
        }

        const ip = getClientIp(req)
        const adminPassword = ADMIN_PASSWORD
        const maxAttempts = MAX_ATTEMPTS
        const banMinutes = BAN_MINUTES

        // 检查是否被封禁
        const banStatus = isIpBanned(ip, maxAttempts, banMinutes)
        if (banStatus.banned) {
          sendJson(res, {
            success: false,
            error: `尝试次数过多，IP 已被封禁 ${banMinutes} 分钟`,
            banned: true,
            remainingAttempts: 0
          }, 429)
          return
        }

        if (!adminPassword) {
          sendJson(res, { success: true })
          return
        }

        try {
          const data = await parseBody(req)
          if (data.password === adminPassword) {
            clearIpRecord(ip)
            sendJson(res, { success: true, remainingAttempts: maxAttempts })
          } else {
            const result = recordFailedAttempt(ip, maxAttempts, banMinutes)
            if (result.banned) {
              sendJson(res, {
                success: false,
                error: `尝试次数过多，IP 已被封禁 ${banMinutes} 分钟`,
                banned: true,
                remainingAttempts: 0
              }, 429)
            } else {
              sendJson(res, {
                success: false,
                error: '管理员密码错误',
                banned: false,
                remainingAttempts: result.remainingAttempts
              })
            }
          }
        } catch (e: any) {
          sendJson(res, { success: false, error: e.message }, 500)
        }
      })

      // 查询管理员认证状态（剩余尝试次数）
      server.middlewares.use('/api/auth/admin-status', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') {
          sendJson(res, { success: false, error: 'Method Not Allowed' }, 405)
          return
        }
        const ip = getClientIp(req)
        const maxAttempts = MAX_ATTEMPTS
        const banMinutes = BAN_MINUTES
        const status = isIpBanned(ip, maxAttempts, banMinutes)
        sendJson(res, {
          banned: status.banned,
          remainingAttempts: status.remainingAttempts,
          maxAttempts,
          banMinutes
        })
      })
    },
    // 构建时将 data/ 目录复制到 dist/
    closeBundle() {
      const distDataDir = path.resolve(__dirname, 'dist', 'data')
      const distImagesDir = path.join(distDataDir, 'xiaomi-images')

      if (!fs.existsSync(DATA_DIR)) return

      if (!fs.existsSync(distDataDir)) {
        fs.mkdirSync(distDataDir, { recursive: true })
      }

      const notesPath = path.join(DATA_DIR, 'notes.json')
      if (fs.existsSync(notesPath)) {
        fs.copyFileSync(notesPath, path.join(distDataDir, 'notes.json'))
      }

      const settingsPath = path.join(DATA_DIR, 'settings.json')
      if (fs.existsSync(settingsPath)) {
        fs.copyFileSync(settingsPath, path.join(distDataDir, 'settings.json'))
      }

      if (fs.existsSync(IMAGES_DIR)) {
        if (!fs.existsSync(distImagesDir)) {
          fs.mkdirSync(distImagesDir, { recursive: true })
        }
        for (const file of fs.readdirSync(IMAGES_DIR)) {
          fs.copyFileSync(
            path.join(IMAGES_DIR, file),
            path.join(distImagesDir, file)
          )
        }
      }

      console.log('📦 已复制 data/ 目录到 dist/')
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      figmaAssetResolver(),
      react(),
      tailwindcss(),
      miNoteDataPlugin(env),
    ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
