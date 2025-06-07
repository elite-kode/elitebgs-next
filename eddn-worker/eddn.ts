import { satisfies } from 'semver'
import type { EDDNBase, JournalMessage } from '@elitebgs/types/eddn.ts'
import { EDDN as eddnModel } from './db/models/eddn.ts'
import { Journal } from './elitebgs/journal.ts'
import softwareGuards from './eddn-software-guards.json' with { type: 'json' }

export class EDDN {
  static async handleMessage(message: EDDNBase) {
    let processed: boolean = false
    if (message.$schemaRef === Journal.getSchema()) {
      if (parseFloat(message.header.gameversion) < 4) {
        console.warn(`Received message from legacy game version: ${message.header.gameversion}. Skipping processing.`)
      } else if (!this.handleMessageSoftware(message.header.softwareName, message.header.softwareVersion)) {
        console.warn(`Received message from disallowed software: ${message.header.softwareName}. Skipping processing.`)
      } else {
        processed = await Journal.trackSystem(message as JournalMessage)
      }
    }
    await EDDN.saveMessage(message.$schemaRef, processed, message)
  }

  private static handleMessageSoftware(softwareName: string, softwareVersion: string): boolean {
    if (
      softwareGuards.disallowed.some((element) => {
        const match = new RegExp(element.softwareName).test(softwareName)
        // If the software is disallowed for all versions, don't allow it
        if (match && element.allVersions) {
          return true
        }
        // If the software is disallowed for specific versions, don't allow it
        if (match && element.softwareVersion !== '0.0.0') {
          return satisfies(softwareVersion, element.softwareVersion, true)
        }
        return false
      })
    ) {
      return false
    }
    return !!softwareGuards.allowed.some((element) => {
      const match = new RegExp(element.softwareName).test(softwareName)
      // If the software is not in the allowed list, don't allow it
      if (!match) {
        return false
      }
      // If the software version is allowed, allow it. else, don't
      return satisfies(softwareVersion, element.softwareVersion, true)
    })
  }

  private static async saveMessage(schemaRef: string, processed: boolean, message: unknown) {
    const eddn = new eddnModel({
      schemaRef,
      processed,
      message,
    })

    await eddn.save()
  }
}
