import { type FSDJump, type JournalMessage, JournalEvents } from '@elitebgs/types/eddn.ts'

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
  static async trackSystem(message: JournalMessage): Promise<boolean> {
    if (message.message.event !== JournalEvents.FSDJump && message.message.event !== JournalEvents.Location) {
      return false // Only track FSDJump and Location events
    }

    let messageBody = (message as FSDJump).message

    if (!(await this.checkMessageJump(messageBody))) {
      return false // Skip processing if the message contains data invalid for EliteBGS
    }

    messageBody = this.coerceMessage(messageBody)

    return false // Placeholder for actual tracking logic
  }

  /**
   * Checks if the message contains all required fields. If any field is missing, it logs a warning and returns false,
   * indicating that the message should not be processed.
   */
  private static async checkMessageJump(message: FSDJump['message']) {
    if (new Date(message.timestamp) < new Date('2017-10-07T00:00:00Z') || new Date(message.timestamp) > new Date()) {
      console.warn(`Received FSDJump message with invalid timestamp: ${message.timestamp}. Skipping processing.`)
      return false
    }
    if (!message.StarSystem) {
      console.warn('Received FSDJump message without StarSystem. Skipping processing.')
      return false
    }
    if (!message.SystemAddress) {
      console.warn(
        `Received FSDJump message without SystemAddress. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
      return false
    }
    if (!message.timestamp) {
      console.warn(`Received FSDJump message without timestamp. Skipping processing. StarSystem: ${message.StarSystem}`)
      return false
    }
    if (!message.StarPos) {
      console.warn(`Received FSDJump message without StarPos. Skipping processing. StarSystem: ${message.StarSystem}`)
      return false
    }
    if (!message.SystemSecurity) {
      console.warn(
        `Received FSDJump message without SystemSecurity. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
      return false
    }
    if (!message.SystemGovernment) {
      console.warn(
        `Received FSDJump message without SystemGovernment. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
      return false
    }
    if (!message.SystemAllegiance) {
      console.warn(
        `Received FSDJump message without SystemAllegiance. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
      return false
    }
    if (!message.SystemEconomy) {
      console.warn(
        `Received FSDJump message without SystemEconomy. Skipping processing. StarSystem: ${message.StarSystem}`,
      )
      return false
    }
    return true
  }

  private static coerceMessage(message: FSDJump['message']): FSDJump['message'] {
    if (!message.SystemFaction.FactionState) {
      message.SystemFaction.FactionState = 'None'
    }

    if (!message.Population) {
      message.Population = 0
    }

    if (!message.Conflicts) {
      message.Conflicts = []
    }

    return message
  }
}
