import { model, Schema } from 'mongoose'

interface IEddn {
  schemaRef: string
  header: unknown
  message: unknown
  processed: boolean
  processingErrors: string[]
}

const eddn = new Schema<IEddn>({
  schemaRef: { type: String, required: true, index: true },
  header: { type: Schema.Types.Mixed, required: true },
  message: { type: Schema.Types.Mixed, required: true },
  processed: { type: Boolean, required: true, index: true },
  processingErrors: { type: [String], required: true },
})

export const EDDN = model<IEddn>('EDDN', eddn)
