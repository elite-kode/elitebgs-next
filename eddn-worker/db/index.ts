import { Sequelize } from 'sequelize'
import { connect, Mongoose } from 'mongoose'
import { Systems, SystemsInit } from './models/systems.ts'
import { SystemAliases, SystemAliasesInit } from './models/system_aliases.ts'
import { SystemHistories, SystemHistoriesInit } from './models/system_histories.ts'
import { Factions, FactionsInit } from './models/factions.ts'
import { SystemFactions, SystemFactionsInit } from './models/system_factions.ts'
import { ActiveStates, ActiveStatesInit } from './models/active_states.ts'
import { PendingStates, PendingStatesInit } from './models/pending_states.ts'
import { RecoveringStates, RecoveringStatesInit } from './models/recovering_states.ts'

export class DB {
  sequelize: Sequelize
  mongoose: Mongoose

  constructor() {
    this.sequelize = new Sequelize(process.env.PG_DB, process.env.PG_USER, process.env.PG_PASS, {
      dialect: 'postgres',
      host: process.env.PG_HOST,
      port: parseInt(process.env.PG_PORT),
    })
  }

  async connect(): Promise<void> {
    await this.connectMongo()
    await this.authenticate()
    this.loadPGModels()
    if (process.env.NODE_ENV !== 'production') {
      await this.sync()
    }
  }

  private async connectMongo() {
    try {
      const options = {
        user: process.env.MONGO_USER,
        pass: process.env.MONGO_PASS,
      }
      this.mongoose = await connect(process.env.MONGO_DB_URL, options)
      console.log('MongoDB connection has been established successfully.')
    } catch (error) {
      console.error('Unable to connect to MongoDB:', error)
    }
  }

  private async authenticate() {
    try {
      await this.sequelize.authenticate()
      console.log('PostgreSQL connection has been established successfully.')
    } catch (error) {
      console.error('Unable to connect to PostgreSQL:', error)
    }
  }

  private loadPGModels() {
    SystemsInit(this.sequelize)
    SystemAliasesInit(this.sequelize)
    SystemHistoriesInit(this.sequelize)
    FactionsInit(this.sequelize)
    SystemFactionsInit(this.sequelize)
    ActiveStatesInit(this.sequelize)
    PendingStatesInit(this.sequelize)
    RecoveringStatesInit(this.sequelize)

    Systems.hasMany(SystemAliases, {
      foreignKey: 'systemId',
    })
    SystemAliases.belongsTo(Systems)

    Systems.hasMany(SystemHistories, {
      foreignKey: 'systemId',
    })
    SystemHistories.belongsTo(Systems)

    Systems.belongsToMany(Factions, {
      through: SystemFactions,
      foreignKey: 'systemId',
    })
    Factions.belongsToMany(Systems, {
      through: SystemFactions,
      foreignKey: 'factionId',
    })

    SystemFactions.hasMany(ActiveStates, {
      foreignKey: 'systemFactionId',
    })
    ActiveStates.belongsTo(SystemFactions)

    SystemFactions.hasMany(PendingStates, {
      foreignKey: 'systemFactionId',
    })
    PendingStates.belongsTo(SystemFactions)

    SystemFactions.hasMany(RecoveringStates, {
      foreignKey: 'systemFactionId',
    })
    RecoveringStates.belongsTo(SystemFactions)
  }

  private async sync() {
    await this.sequelize.sync({ alter: true })
  }
}
