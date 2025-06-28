import { config } from 'dotenv'
import { DB } from './db/index.ts'
import { App } from './app.ts'

config()

const db = new DB()
await db.connect()

new App(db.sequelize)

process.on('unhandledRejection', (reason, promise) => {
  console.error(`Unhandled promise rejection ${promise} for reason ${reason}`)
})
