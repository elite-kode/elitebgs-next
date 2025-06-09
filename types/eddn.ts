export type EDDNBase = {
  $schemaRef: string
  header: {
    gameversion: string
    gamebuild: string
    gatewayTimestamp: string
    softwareName: string
    softwareVersion: string
    uploaderID: string
  }
}

export type JournalMessage = EDDNBase & {
  message: {
    event: JournalEvents
  }
}

export enum JournalEvents {
  FSDJump = 'FSDJump',
  Location = 'Location',
}

export type FSDJump = EDDNBase & {
  message: {
    event: JournalEvents.FSDJump
    timestamp: string
    SystemAddress: string
    StarSystem: string
    StarPos: number[]
    SystemAllegiance: string
    SystemEconomy: string
    SystemSecondEconomy: string
    SystemGovernment: string
    SystemSecurity: string
    Population: number
    Factions?: Faction[]
    SystemFaction?: SystemFaction
    Powers?: string[]
    ControllingPower?: string
    PowerplayState?: string
    PowerplayStateControlProgress?: number
    PowerplayStateReinforcement?: number
    PowerplayStateUndermining?: number
    PowerplayConflictProgress?: PowerplayConflict[]
    Conflicts?: FactionConflict[]
  }
}

export type FactionConflict = {
  WarType: string
  Status: string
  Faction1: ConflictFaction
}

export type ConflictFaction = {
  Name: string
  Stake: string
  WonDaysAgo: number
}

export type PowerplayConflict = {
  Power: string
  ConflictProgress: number
}

export type SystemFaction = {
  Name: string
  FactionState: string
}

export type Location = JournalMessage & {}

export type Faction = SystemFaction & {
  Influence: number
  Government: string
  Allegiance: string
  Happiness: string
  ActiveStates?: State[]
  PendingStates?: State[]
  RecoveringStates?: State[]
}

export type State = {
  State: string
  Trend: number
}
