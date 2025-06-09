import { Subscriber } from 'zeromq'
import axios, { type AxiosInstance } from 'axios'
import { inflateSync } from 'node:zlib'
import type { EDDNBase } from '@elitebgs/types/eddn.ts'

/**
 * EDDN Listener sets up listening to the Elite Dangerous Data Network (EDDN) for messages. Parses the messages and
 * sends them to handlers based on their schema.
 */
export class Listener {
  sock: Subscriber
  axiosInstance: AxiosInstance

  constructor() {
    this.sock = new Subscriber()
    this.connect()
    this.setupAxiosInstance()
  }

  private setupAxiosInstance() {
    this.axiosInstance = axios.create({
      baseURL: process.env.WORKER_URL,
    })

    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response
      },
      (err) => {
        console.error(`Error while calling worker: ${err}`)
      },
    )
  }

  /** Connects to the EDDN message and subscribes to all messages. */
  private connect() {
    this.sock.connect(process.env.EDDN_URL)
    this.sock.subscribe('')
    console.log('Connected to EDDN')
  }

  /** Listens for messages from the EDDN and processes them. */
  async listen() {
    for await (const [msg] of this.sock) {
      let message: EDDNBase
      try {
        message = JSON.parse(inflateSync(msg).toString())
      } catch (err) {
        console.error('Error parsing message as a JSON:', err)
        continue
      }
      this.sendMessage(message)
    }
  }

  /** Sends the message to a load balanced worker */
  private sendMessage(message: EDDNBase) {
    this.axiosInstance.post('', message)
  }
}
