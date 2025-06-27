import type { EDDNBase, FSDJump, JournalMessage, State } from '@elitebgs/types/eddn.ts'
import { JournalEvents } from '@elitebgs/types/eddn.ts'
import { Op, Sequelize, Transaction } from 'sequelize'
import { difference, intersection, isEqualWith, uniq } from 'lodash'
import { Systems } from '../db/models/systems.ts'
import { SystemAliases } from '../db/models/system_aliases.ts'
import { Factions } from '../db/models/factions.ts'
import { SystemFactions } from '../db/models/system_factions.ts'
import { ActiveStates } from '../db/models/active_states.ts'
import { RecoveringStates } from '../db/models/recovering_states.ts'
import { PendingStates } from '../db/models/pending_states.ts'

export type TrackSystemResponse = {
  processed: boolean
  processingMessages: string[]
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
      return { processed: false, processingMessages: ['Not a FSDJump or Location event. Skipping processing.'] }
    }

    const messageBody = (message as FSDJump).message
    const messageHeader = message.header

    try {
      const errors = await this.checkMessageJump(messageBody)

      // Skip processing if the message contains data invalid for EliteBGS.
      if (errors.length > 0) {
        return { processed: false, processingMessages: errors }
      }
    } catch (err) {
      return {
        processed: false,
        processingMessages: [`Error occurred while validating message. Skipping processing. Error: ${err}`],
      }
    }

    this.coerceMessage(messageBody)

    try {
      await sequelize.transaction(async (transaction) => {
        const {
          factions,
          processed: factionProcessed,
          processingMessages: factionProcessingMessages,
        } = await this.ensureFactions(messageBody, transaction)

        const {
          system,
          processed: systemProcessed,
          processingMessages: systemProcessingMessages,
        } = await this.ensureSystemWAliases(messageBody, transaction)

        const { processed: systemHistoriesProcessed, processingMessages: systemHistoriesProcessingMessages } =
          await this.ensureSystemHistory(messageBody, messageHeader, system, factions, transaction)

        const { processed: factionHistoriesProcessed, processingMessages: factionHistoriesProcessingMessages } =
          await this.ensureFactionSystemHistory(messageBody, messageHeader, system, factions, transaction)

        // If no errors occur, then the `processed` value is determined based on if at least 1 entity was processed.
        // And all the messages generated are also returned.
        return {
          processed: systemProcessed || systemHistoriesProcessed || factionProcessed || factionHistoriesProcessed,
          processingMessages: systemProcessingMessages
            .concat(systemHistoriesProcessingMessages)
            .concat(factionProcessingMessages)
            .concat(factionHistoriesProcessingMessages),
        }
      })
    } catch (err) {
      return {
        processed: false,
        processingMessages: [`Error occurred while in DB operation. Skipping processing. Error: ${err}`],
      }
    }

    return { processed: true, processingMessages: [] }
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

      return { system, processed: true, processingMessages: ['System created.'] }
    }

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

    return { system, processed: true, processingMessages: ['System updated.'] }
  }

  /**
   * Get the current system history record, i.e. one with `validTo` as NULL and records that became valid within the
   * last 48 hours. If no current history record is found or if the message has different data than the current record,
   * a fresh history record is created.
   */
  private static async ensureSystemHistory(
    message: FSDJump['message'],
    header: EDDNBase['header'],
    system: Systems,
    factions: Factions[],
    transaction: Transaction,
  ) {
    let timeNow: number
    if (process.env.LOAD_ARCHIVE === 'true') {
      timeNow = header.gatewayTimestamp.getTime()
    } else {
      timeNow = Date.now()
    }

    // Get the current status of the system by finding the record which doesn't have a `validTo`.
    const currentSystemStatusPromise = system.getSystemHistories({
      where: {
        validTo: {
          [Op.is]: null,
        },
      },
      limit: 1,
      order: [['validFrom', 'DESC']],
      transaction,
    })

    // Get all the historical records of the system in the last 48 hours that have a `validTo`.
    const systemHistoriesPromise = system.getSystemHistories({
      where: {
        validFrom: {
          [Op.gte]: new Date(timeNow - 172800000),
        },
        validTo: {
          [Op.not]: null,
        },
      },
      order: [['validFrom', 'DESC']],
      transaction,
    })

    const promiseSettled = await Promise.all([currentSystemStatusPromise, systemHistoriesPromise])
    const currentSystemStatus = promiseSettled[0].at(0)
    const systemHistories = promiseSettled[1]

    // Check if the message contains the same data as the current state.
    if (
      currentSystemStatus &&
      currentSystemStatus.population === message.Population &&
      currentSystemStatus.systemGovernment === message.SystemGovernment &&
      currentSystemStatus.systemAllegiance === message.SystemAllegiance &&
      currentSystemStatus.systemSecurity === message.SystemSecurity &&
      currentSystemStatus.systemEconomy === message.SystemEconomy &&
      currentSystemStatus.systemSecondEconomy === message.SystemSecondEconomy
    ) {
      return { processed: false, processingMessages: ['Message is the same as the current system record.'] }
    }

    // Get the faction data of the system faction.
    const systemFaction = factions.find((faction) => faction.nameLower === message.SystemFaction.Name.toLowerCase())

    if (!systemFaction) {
      throw new Error(`Unable to find the faction record for the faction ${message.SystemFaction.Name}.`)
    }

    // Run some checks on the message with the existing history to verify that it should be processed.
    if (systemHistories.length > 0) {
      // If the message timestamp is older than the start of the latest record, or older than the end of the latest
      // record, skip processing.
      if (message.timestamp < systemHistories[0].validFrom || message.timestamp < systemHistories[0].validTo) {
        return { processed: false, processingMessages: ['Message is older than the latest record.'] }
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
            history.systemSecondEconomy === message.SystemSecondEconomy &&
            history.systemFactionId === systemFaction.id &&
            history.systemFactionState === message.SystemFaction.FactionState,
        )
      ) {
        return { processed: false, processingMessages: ['Message is probably cached.'] }
      }
    }

    // If there is a current system status history record, mark the `validTo` of the latest record as a new record
    // is to be added.
    if (currentSystemStatus) {
      await currentSystemStatus.update(
        {
          validTo: message.timestamp,
        },
        { transaction },
      )
    }
    await system.createSystemHistory(
      {
        population: message.Population,
        systemGovernment: message.SystemGovernment,
        systemAllegiance: message.SystemAllegiance,
        systemSecurity: message.SystemSecurity,
        systemEconomy: message.SystemEconomy,
        systemSecondEconomy: message.SystemSecondEconomy,
        systemFactionId: systemFaction.id,
        systemFactionState: message.SystemFaction.FactionState.toLowerCase(),
        validFrom: message.timestamp,
      },
      { transaction },
    )

    return { processed: true, processingMessages: ['System history created.'] }
  }

  /**
   * Find the faction with the faction name. If the faction with the faction name doesn't exist, a new record is
   * created.
   */
  private static async ensureFactions(message: FSDJump['message'], transaction: Transaction) {
    const factionPromises = await Promise.all(
      message.Factions.map(async (messageFaction) => {
        let faction = await Factions.findOne({
          where: { nameLower: messageFaction.Name.toLowerCase() },
          transaction,
        })

        if (!faction) {
          faction = await Factions.create(
            {
              name: messageFaction.Name,
              nameLower: messageFaction.Name.toLowerCase(),
              government: messageFaction.Government,
              allegiance: messageFaction.Allegiance,
            },
            {
              transaction,
            },
          )
        }

        return { faction, processed: true, processingMessages: [`System ${message.StarSystem} created.`] }
      }),
    )

    return {
      factions: factionPromises.map((factionPromise) => factionPromise.faction),
      processed: factionPromises.some((factionPromise) => factionPromise.processed),
      processingMessages: factionPromises.flatMap((factionPromise) => factionPromise.processingMessages),
    }
  }

  /** Get all the current faction history records and all the historical records for the last 48 hours. */
  private static async ensureFactionSystemHistory(
    message: FSDJump['message'],
    header: EDDNBase['header'],
    system: Systems,
    factions: Factions[],
    transaction: Transaction,
  ) {
    let timeNow: number
    if (process.env.LOAD_ARCHIVE === 'true') {
      timeNow = header.gatewayTimestamp.getTime()
    } else {
      timeNow = Date.now()
    }

    // Get the current status of all the factions currently in the system, determined by searching for records that
    // don't have a `validTo` entry.
    const currentFactionsStatusPromise = system.getSystemFactionHistories({
      where: {
        validTo: {
          [Op.is]: null,
        },
      },
      order: [
        ['validFrom', 'DESC'],
        ['factionId', 'ASC'],
      ],
      include: [ActiveStates, PendingStates, RecoveringStates],
      transaction,
    })

    // Get all the historical records for all the factions in teh system in the last 48 hours that have a `validTo`.
    const factionHistoriesPromise = system.getSystemFactionHistories({
      where: {
        validFrom: {
          [Op.gte]: new Date(timeNow - 172800000),
        },
        validTo: {
          [Op.not]: null,
        },
      },
      order: [
        ['validFrom', 'DESC'],
        ['factionId', 'ASC'],
      ],
      include: [ActiveStates, PendingStates, RecoveringStates],
      transaction,
    })

    const promiseSettled = await Promise.all([currentFactionsStatusPromise, factionHistoriesPromise])
    const currentFactionsStatus = promiseSettled[0]
    const factionsHistories = promiseSettled[1]

    const factionsCurrentlyPresent = uniq(currentFactionsStatus.map((systemFaction) => systemFaction.factionId))
    const factionsInMessage = factions.map((faction) => faction.id)

    // Create 3 sets of factions based on what kind of operation needs to be done on them.
    const factionsRemovedIds = difference(factionsCurrentlyPresent, factionsInMessage)
    const factionsAddedIds = difference(factionsInMessage, factionsCurrentlyPresent)
    const factionsMaybeUpdatedIds = intersection(factionsCurrentlyPresent, factionsInMessage)

    const processingMessages: string[] = []

    // This starts a complicated logic to figure out if a faction that's supposedly removed from the system is actually
    // removed or if the message is a cached message. For this, we need to figure out if the faction was added within
    // the last 48 hours. Which means that in the last 48 hours there should be a gap between the `validTo` of one
    // record and the `validFrom` of the next record.
    // An edge case also needs to be taken into account where the first record that became valid in the last 48 hours
    // was the addition of the faction, in which case, we don't have a previous record to compare against. So, if we
    // don't find a gap between 2 records in the last 48 hours, we need to find the last record before 48 hours and
    // compare it's `validTo` to the `validFrom` of the first record that became valid within 48 hours.
    const filteredFactionRemovedIds = []

    for (const factionRemovedId of factionsRemovedIds) {
      const factionHistories = factionsHistories.filter((history) => history.factionId === factionRemovedId)
      const currentFactionStatus = currentFactionsStatus.filter((status) => status.factionId === factionRemovedId)

      const completeFactionHistories = currentFactionStatus.concat(factionHistories)

      // `checkNewEntry` will keep track if the faction is a newly entered one or not.
      let checkNewEntry = false

      // Check every adjacent record's `validTo` and `validFrom`.
      for (let i = 0; i < completeFactionHistories.length - 1; i++) {
        if (completeFactionHistories[i].validFrom > completeFactionHistories[i + 1].validTo) {
          checkNewEntry = true
          break
        }
      }

      // If no gaps are found, we need to check with the last record that went valid before 48 hours.
      if (!checkNewEntry) {
        const factionHistoryMarginCheck = await system.getSystemFactionHistories({
          where: {
            factionId: factionRemovedId,
            validFrom: {
              [Op.lt]: new Date(timeNow - 172800000),
            },
          },
          limit: 1,
          transaction,
        })
        checkNewEntry =
          factionHistoryMarginCheck.at(0)?.validTo <
          completeFactionHistories[completeFactionHistories.length - 1].validFrom
      }

      if (checkNewEntry) {
        processingMessages.push(`Faction with id ${factionRemovedId} is probably cached.`)
        continue
      }

      filteredFactionRemovedIds.push(factionRemovedId)
    }

    // Filter all factions that were removed, and update the validTo for each of these records.
    const systemFactionHistoriesRemovedPromise = currentFactionsStatus
      .filter((status) => filteredFactionRemovedIds.includes(status.factionId))
      .map((factionHistory) => {
        return factionHistory.update(
          {
            validTo: message.timestamp,
          },
          { transaction },
        )
      })

    // Filter all factions that were added, and check if the message faction is the same as any historical record. If
    // not, create a new record.
    const systemFactionHistoriesAddedPromise = factions
      .filter((faction) => factionsAddedIds.includes(faction.id))
      .map(async (faction) => {
        // We get the current faction in the message.
        const factionInMessage = message.Factions.find(
          (messageFaction) => messageFaction.Name.toLowerCase() === faction.nameLower,
        )

        const isCached = Journal.checkSystemFactionHistoryCache(factionsHistories, faction, factionInMessage)
        if (isCached) {
          return
        }

        return Journal.createSystemFactionHistoryRecord(system, faction, factionInMessage, message.timestamp)
      })

    const systemFactionHistoriesUpdatedPromise = factions
      .filter((faction) => factionsMaybeUpdatedIds.includes(faction.id))
      .map(async (faction) => {
        // We get the current faction in the message.
        const factionInMessage = message.Factions.find(
          (messageFaction) => messageFaction.Name.toLowerCase() === faction.nameLower,
        )

        const isCached = Journal.checkSystemFactionHistoryCache(factionsHistories, faction, factionInMessage)
        if (isCached) {
          return
        }

        const currentFactionStatus = currentFactionsStatus.find((status) => status.factionId === faction.id)
        await currentFactionStatus.update(
          {
            validTo: message.timestamp,
          },
          { transaction },
        )

        return Journal.createSystemFactionHistoryRecord(system, faction, factionInMessage, message.timestamp)
      })

    await Promise.all([
      systemFactionHistoriesRemovedPromise,
      systemFactionHistoriesAddedPromise,
      systemFactionHistoriesUpdatedPromise,
    ])

    return { processed: true, processingMessages: processingMessages }
  }

  /**
   * Check if the given faction in the message has data that is the same as any record for that faction in the last 48
   * hours.
   */
  private static checkSystemFactionHistoryCache(
    systemFactionHistories: SystemFactionHistories[],
    faction: Factions,
    factionInMessage: Faction,
  ) {
    return systemFactionHistories
      .filter((history) => history.factionId === faction.id)
      .some((history) => {
        // In here each history record for this faction gets checked with the message data to verify if there are
        // any records that match.
        return (
          history.influence === factionInMessage.Influence &&
          history.happiness === factionInMessage.Happiness &&
          history.factionState === factionInMessage.FactionState &&
          isEqualWith(
            history.ActiveStates,
            factionInMessage.ActiveStates,
            (historyElement: ActiveStates, messageElement: State) => {
              return historyElement.state === messageElement.State
            },
          ) &&
          isEqualWith(
            history.PendingStates,
            factionInMessage.PendingStates,
            (historyElement: PendingStates, messageElement: State) => {
              return historyElement.state === messageElement.State && historyElement.trend === messageElement.Trend
            },
          ) &&
          isEqualWith(
            history.RecoveringStates,
            factionInMessage.RecoveringStates,
            (historyElement: RecoveringStates, messageElement: State) => {
              return historyElement.state === messageElement.State && historyElement.trend === messageElement.Trend
            },
          )
        )
      })
  }

  /**
   * Handle the creation of a SystemFactionHistory record which involves creating the record and the various states
   * together with it.
   */
  private static async createSystemFactionHistoryRecord(
    system: Systems,
    faction: Factions,
    factionInMessage: Faction,
    timestamp: Date,
  ) {
    const createdSystemFactionHistory = await system.createSystemFactionHistory({
      factionId: faction.id,
      factionState: factionInMessage.FactionState,
      influence: factionInMessage.Influence,
      happiness: factionInMessage.Happiness,
      validFrom: timestamp,
    })
    const activeStatesPromise = factionInMessage.ActiveStates.map((activeState) => {
      return createdSystemFactionHistory.createActiveState({
        state: activeState.State,
      })
    })
    const pendingStatesPromise = factionInMessage.PendingStates.map((pendingState) => {
      return createdSystemFactionHistory.createPendingStates({
        state: pendingState.State,
        trend: pendingState.Trend,
      })
    })
    const recoveringStatesPromise = factionInMessage.RecoveringStates.map((recoveringState) => {
      return createdSystemFactionHistory.createRecoveringStates({
        state: recoveringState.State,
        trend: recoveringState.Trend,
      })
    })

    return Promise.all(activeStatesPromise.concat(pendingStatesPromise).concat(recoveringStatesPromise))
  }

  /**
   * Checks if the message contains all required fields. If any field is missing, it logs a warning and returns false,
   * indicating that the message should not be processed.
   */
  private static async checkMessageJump(message: FSDJump['message']) {
    const errors: string[] = []
    if (message.timestamp < new Date('2017-10-07T00:00:00Z') || message.timestamp > new Date()) {
      errors.push(
        `Received FSDJump message with invalid timestamp: ${message.timestamp.toISOString()}. Skipping processing.`,
      )
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

  /** Fix certain issues that are expected in the incoming message. */
  private static coerceMessage(message: FSDJump['message']) {
    if (!message.SystemFaction.FactionState) {
      message.SystemFaction.FactionState = 'None'
    }
  }
}
