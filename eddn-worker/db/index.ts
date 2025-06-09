import { Sequelize } from 'sequelize'
import { connect, Mongoose } from 'mongoose'
import { SystemInit } from './models/system.ts'

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
    SystemInit(this.sequelize)
    // GuildInit(this.sequelize)
    // BankInit(this.sequelize)
    // UserInit(this.sequelize)
    // UserBankInit(this.sequelize)
    //
    // Guild.hasOne(Bank, { foreignKey: { name: 'guildId', allowNull: false }, onDelete: 'CASCADE', onUpdate: 'CASCADE' })
    // Bank.belongsTo(Guild)
    //
    // User.belongsToMany(Bank, { through: UserBank, foreignKey: 'userId' })
    // Bank.belongsToMany(User, { through: UserBank, foreignKey: 'bankId' })
  }

  private async sync() {
    await this.sequelize.sync({ alter: true })
  }
}
