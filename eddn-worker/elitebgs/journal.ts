import { JournalEvents } from '@elitebgs/types/eddn.ts'
import type { EDDNBase, FSDJump, JournalMessage } from '@elitebgs/types/eddn.ts'
import { Op, Sequelize, Transaction } from 'sequelize'
import { Systems } from '../db/models/systems.ts'
import { SystemAliases } from '../db/models/system_aliases.ts'

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
      // Only track FSDJump and Location events.
      return { processed: false, processingErrors: ['Not a FSDJump or Location event. Skipping processing.'] }
    }

    const messageBody = (message as FSDJump).message
    const messageHeader = message.header

    try {
      const errors = await this.checkMessageJump(messageBody)

      // Skip processing if the message contains data invalid for EliteBGS.
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
        const system = await this.ensureSystemWAliases(messageBody, transaction)

        const systemHistories = await this.ensureSystemHistory(messageBody, messageHeader, system, transaction)

        console.log(`System histories: ${systemHistories}`)
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
   * Find the system with the system address along with its aliases. If the system with the system address exists, check
   * if the name is the same and create an alias if not. An alias is only created if that alias is previously not
   * created. If the system address doesn't exist, a new record is created.
   */
  private static async ensureSystemWAliases(message: FSDJump['message'], transaction: Transaction) {
    let system = await Systems.findOne({
      where: { systemAddress: message.SystemAddress.toString() },
      include: [SystemAliases],
      transaction,
    })

    if (!system) {
      console.debug(`System ${message.StarSystem} doesn't exist. Creating...`)
      system = await Systems.create(
        {
          starSystem: message.StarSystem,
          starSystemLower: message.StarSystem.toLowerCase(),
          systemAddress: message.SystemAddress.toString(),
          starPos: {
            type: 'Point',
            coordinates: message.StarPos,
            crs: { type: 'name', properties: { name: '0' } },
          },
        },
        {
          transaction,
        },
      )
    } else {
      if (message.StarSystem !== system.starSystem) {
        const systemAliases = system.SystemAliases
        // Checking the actual names so that even changing the case will create an alias.
        if (!systemAliases.some((alias) => alias.alias === message.StarSystem)) {
          await system.createSystemAlias(
            {
              alias: system.starSystem,
              aliasLower: system.starSystemLower,
            },
            { transaction },
          )
          await system.update(
            {
              starSystem: message.StarSystem,
              starSystemLower: message.StarSystem.toLowerCase(),
            },
            { transaction },
          )
        }
      }
    }

    return system
  }

  /**
   * Get all system history records that became valid within the last 48 hours. If no system history records are found
   * that became valid within the last 48 hours, the last record that is there is fetched. If still no system history is
   * found, then the system is newly created, and a fresh history record is created.
   */
  private static async ensureSystemHistory(
    message: FSDJump['message'],
    header: EDDNBase['header'],
    system: Systems,
    transaction: Transaction,
  ) {
    let timeNow: number
    if (process.env.LOAD_ARCHIVE === 'true') {
      timeNow = header.gatewayTimestamp.getTime()
    } else {
      timeNow = Date.now()
    }

    // Get all the history records up to 48 hours earlier.
    let systemHistories = await system.getSystemHistories({
      where: {
        validFrom: {
          [Op.gte]: new Date(timeNow - 172800000),
        },
      },
      order: [['validFrom', 'DESC']],
      transaction,
    })

    // If there are no history records, try to get the most recent history record available
    // earlier than the message timestamp.
    if (systemHistories.length === 0) {
      systemHistories = await system.getSystemHistories({
        limit: 1,
        order: [['validFrom', 'DESC']],
        transaction,
      })
    }

    // Run some checks on the message with the existing history to verify that it should be processed.
    if (systemHistories.length > 0) {
      // If the message timestamp is older than the start of the latest record, skip processing.
      if (message.timestamp < systemHistories[0].validFrom) {
        return systemHistories
      }

      // If the message timestamp is newer than the start of the latest record but older than the end of
      // that record, which might happen if the latest record's validity has been closed. This will probably
      // not happen for system histories, but still added to keep the logic similar to faction histories.
      if (message.timestamp < systemHistories[0].validTo) {
        return systemHistories
      }

      // If the system data matches all values for any data in the last 48 hours, skip processing.
      if (
        systemHistories.some(
          (history) =>
            history.population === message.Population &&
            history.systemGovernment === message.SystemGovernment &&
            history.systemAllegiance === message.SystemAllegiance &&
            history.systemSecurity === message.SystemSecurity &&
            history.systemEconomy === message.SystemEconomy &&
            history.systemSecondEconomy === message.SystemSecondEconomy,
        )
      ) {
        return systemHistories
      }
    }

    // If there are existing history records, mark the validTo of the latest record as a new record is to be added.
    if (systemHistories.length > 0) {
      await systemHistories[0].update(
        {
          validTo: message.timestamp,
        },
        { transaction },
      )
    }
    const insertedSystemHistory = await system.createSystemHistory(
      {
        population: message.Population,
        systemGovernment: message.SystemGovernment,
        systemAllegiance: message.SystemAllegiance,
        systemSecurity: message.SystemSecurity,
        systemEconomy: message.SystemEconomy,
        systemSecondEconomy: message.SystemSecondEconomy,
        validFrom: message.timestamp,
      },
      { transaction },
    )
    systemHistories.push(insertedSystemHistory)

    return systemHistories
  }

  /**
   * Checks if the message contains all required fields. If any field is missing, it logs a warning and returns false,
   * indicating that the message should not be processed.
   */
  private static async checkMessageJump(message: FSDJump['message']) {
    const errors: string[] = []
    if (message.timestamp < new Date('2017-10-07T00:00:00Z') || message.timestamp > new Date()) {
      errors.push(`Received FSDJump message with invalid timestamp: ${message.timestamp.toISOString()}. Skipping processing.`)
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
    if (!message.Factions || message.Factions.length === 0) {
      errors.push(`Received FSDJump message without Factions. Skipping processing. StarSystem: ${message.StarSystem}`)
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
