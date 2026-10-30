// 环境变量引导模块
// 必须作为 index.js 的第一个 import：ESM 会先求值所有依赖模块，
// 若放在 index.js 正文里调用 dotenv.config()，则 auth.js 等模块在顶层读取
// process.env 时环境变量尚未注入，会静默回退到默认值（曾导致生产环境使用默认 JWT 密钥）。
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
