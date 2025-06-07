import { config } from 'dotenv'
import { DB } from './db/index.ts'
import { App } from './app.ts'

config()

const db = new DB()
await db.connect()

new App()
