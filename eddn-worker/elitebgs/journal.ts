import { type FSDJump, JournalEvents, type JournalMessage } from '@elitebgs/types/eddn.ts'
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

        const systemHistories = await this.ensureSystemHistory(messageBody, system, transaction)

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
  private static async ensureSystemHistory(message: FSDJump['message'], system: Systems, transaction: Transaction) {
    const timeNow = Date.now()

    let systemHistories = await system.getSystemHistories({
      where: {
        validFrom: {
          [Op.gte]: new Date(timeNow - 172800000),
        },
      },
      order: [['validFrom', 'DESC']],
      transaction,
    })

    if (systemHistories.length === 0) {
      systemHistories = await system.getSystemHistories({
        limit: 1,
        order: [['validFrom', 'DESC']],
        transaction,
      })
    }

    // If the system data matches all values for any data in the last 48 hours, skip processing.
    if (
      systemHistories.length > 0 &&
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
    // If there are existing history records, mark the validTo of the latest record as a new record is to be added.
    if (systemHistories.length > 0) {
      await systemHistories[0].update(
        {
          validTo: new Date(message.timestamp),
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
        validFrom: new Date(message.timestamp),
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
