import { config } from 'dotenv'
import { Listener } from './listener.ts'

config()

const listener = new Listener()

listener.listen()
