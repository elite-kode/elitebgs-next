import { model, Schema } from 'mongoose'

interface IEDDN {
  schemaRef: string
  header: unknown
  message: unknown
  processed: boolean
  processingErrors: string[]
}

const eddn = new Schema<IEDDN>({
  schemaRef: { type: String, required: true, index: true },
  header: { type: Schema.Types.Mixed, required: true },
  message: { type: Schema.Types.Mixed, required: true },
  processed: { type: Boolean, required: true, index: true },
  processingErrors: { type: [String], required: true },
})

export const EDDN = model<IEDDN>('EDDN', eddn)
