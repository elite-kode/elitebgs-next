import { model, Schema } from 'mongoose'

interface IEddn {
  schemaRef: string
  processed: boolean
  processingErrors: string[]
  message: unknown
}

const eddn = new Schema<IEddn>({
  schemaRef: { type: String, required: true, index: true },
  processed: { type: Boolean, required: true, index: true },
  processingErrors: { type: [String], required: true },
  message: { type: Schema.Types.Mixed, required: true },
})

export const EDDN = model<IEddn>('EDDN', eddn)
