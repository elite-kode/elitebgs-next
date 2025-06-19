import express, { type Express } from 'express'
import { Server, IncomingMessage, ServerResponse } from 'http'
import { createServer } from 'node:http'
import { EDDN } from './eddn.ts'
import { Sequelize } from 'sequelize'

export class App {
  app: Express
  port: number
  server: Server<typeof IncomingMessage, typeof ServerResponse>
  sequelize: Sequelize

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize
    this.app = express()
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))
    this.routes()
    this.connect()
  }

  private connect() {
    this.port = this.validatePort(parseInt(process.env.PORT))
    this.app.set('port', this.port)

    this.server = createServer(this.app)
    this.server.listen(this.port)

    this.server.on('error', this.onError.bind(this))
    this.server.on('listening', this.onListening.bind(this))
  }

  private validatePort(port: number) {
    if (port < 0) {
      throw new Error('Port must be a whole number')
    }
    return port
  }

  onError(error) {
    if (error.syscall !== 'listen') {
      throw error
    }

    const bind = typeof this.port === 'string' ? `Pipe ${this.port}` : `Port ${this.port}`

    switch (error.code) {
      case 'EACCES':
        console.error(`${bind} requires elevated privileges`)
        process.exit(1)
        break
      case 'EADDRINUSE':
        console.error(`${bind} is already in use`)
        process.exit(1)
        break
      default:
        throw error
    }
  }

  onListening() {
    const addr = this.server.address()
    const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`
    console.debug(`Listening on ${bind}`)
  }

  routes() {
    this.app.post('/', this.handleMessage.bind(this))
  }

  async handleMessage(req, res) {
    console.log('--------Handle new message--------')
    await EDDN.handleMessage(req.body, this.sequelize)
    console.log('----------Message handled----------')
    res.status(202).send({
      status: 'success',
    })
  }
}
