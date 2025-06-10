import { type FSDJump, type JournalMessage, JournalEvents } from '@elitebgs/types/eddn.ts'
import { Sequelize } from 'sequelize'
import { createSystem, findSystem, updateSystemName } from '../db/repository/systems.ts'

export type TrackSystemResponse = {
  processed: boolean
  processingErrors: string[]
}

/** Responsible for handling EDDN journal messages. */
export class Journal {
  static SCHEMA_OUTDATED = 'http://schemas.elite-markets.net/eddn/journal/1'
  static SCHEMA = 'https://eddn.edcd.io/schemas/journal/1'
  static SCHEMA_TEST = 'https://eddn.edcd.io/schemas/journal/1/test'

  /**
   * Returns the schema URL based on the environment variable TEST_SCHEMA. If TEST_SCHEMA is set to 'true', it returns
   * the test schema, otherwise it returns the production schema.
   */
  static getSchema() {
    return process.env.TEST_SCHEMA === 'true' ? Journal.SCHEMA_TEST : Journal.SCHEMA
  }

  /**
   * Tracks the system from the journal message. This method is called when a journal message is received and matches
   * the schema for journal messages.
   */
  static async trackSystem(message: JournalMessage, sequelize: Sequelize): Promise<TrackSystemResponse> {
    if (message.message.event !== JournalEvents.FSDJump && message.message.event !== JournalEvents.Location) {
      return { processed: false, processingErrors: ['Not a FSDJump or Location event. Skipping processing.'] } // Only track FSDJump and Location events
    }

    const messageBody = (message as FSDJump).message

    try {
      const errors = await this.checkMessageJump(messageBody)

      // Skip processing if the message contains data invalid for EliteBGS
      if (errors.length > 0) {
        return { processed: false, processingErrors: errors }
      }
    } catch (err) {
      return {
        processed: false,
        processingErrors: [`Error occurred while validating message. Skipping processing. Error: ${err}`],
      }
    }

    // messageBody = this.coerceMessage(messageBody)

    try {
      await sequelize.transaction(async (transaction) => {
        let system = await findSystem(messageBody.SystemAddress, transaction)

        if (!system) {
          console.debug(`System ${messageBody.StarSystem} doesn't exist. Creating...`)
          system = await createSystem(messageBody, transaction)
        } else {
          if (messageBody.StarSystem !== system.starSystem) {
            const systemAliases = await system.getSystemAliases()
            if (!systemAliases.some((alias) => alias.alias === messageBody.StarSystem.toLowerCase())) {
              await system.createSystemAlias({
                alias: system.starSystem,
                aliasLower: system.starSystemLower,
              })
              await updateSystemName(system.id, messageBody.StarSystem, transaction)
            }
          }
        }
      })
    } catch (err) {
      return {
        processed: false,
        processingErrors: [`Error occurred while in DB operation. Skipping processing. Error: ${err}`],
      }
    }

    return { processed: true, processingErrors: [] }
  }

  /**
   * Checks if the message contains all required fields. If any field is missing, it logs a warning and returns false,
   * indicating that the message should not be processed.
   */
  private static async checkMessageJump(message: FSDJump['message']) {
    const errors: string[] = []
    if (new Date(message.timestamp) < new Date('2017-10-07T00:00:00Z') || new Date(message.timestamp) > new Date()) {
      errors.push(`Received FSDJump message with invalid timestamp: ${message.timestamp}. Skipping processing.`)
    }
    if (message.StarSystem === undefined) {
      errors.push('Received FSDJump message without StarSystem. Skipping processing.')
    }
    if (message.SystemAddress === undefined) {
      errors.push(
        `Received FSDJump message without SystemAddress. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
    }
    if (message.timestamp === undefined) {
      errors.push(`Received FSDJump message without timestamp. Skipping processing. StarSystem: ${message.StarSystem}`)
    }
    if (message.StarPos === undefined) {
      errors.push(`Received FSDJump message without StarPos. Skipping processing. StarSystem: ${message.StarSystem}`)
    }
    if (message.SystemSecurity === undefined) {
      errors.push(
        `Received FSDJump message without SystemSecurity. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
    }
    if (message.SystemGovernment === undefined) {
      errors.push(
        `Received FSDJump message without SystemGovernment. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
    }
    if (message.SystemAllegiance === undefined) {
      errors.push(
        `Received FSDJump message without SystemAllegiance. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
    }
    if (message.SystemEconomy === undefined) {
      errors.push(
        `Received FSDJump message without SystemEconomy. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
    }
    if (message.SystemSecondEconomy === undefined) {
      errors.push(
        `Received FSDJump message without SystemSecondEconomy. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
    }
    if (message.Population === undefined) {
      errors.push(`Received FSDJump message without Population. Skipping processing. StarSystem: ${message.StarSystem}`)
    }
    return errors
  }

  // private static coerceMessage(message: FSDJump['message']): FSDJump['message'] {
  //   if (!message.SystemFaction.FactionState) {
  //     message.SystemFaction.FactionState = 'None'
  //   }
  //
  //   if (!message.Population) {
  //     message.Population = 0
  //   }
  //
  //   if (!message.Conflicts) {
  //     message.Conflicts = []
  //   }
  //
  //   return message
  // }
}
