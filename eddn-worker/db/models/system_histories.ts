import type { CreationOptional, ForeignKey, InferAttributes, InferCreationAttributes } from 'sequelize'
import { DataTypes, Model, Sequelize } from 'sequelize'
import { Systems } from './systems.ts'
import { Factions } from './factions.ts'

export class SystemHistories extends Model<InferAttributes<SystemHistories>, InferCreationAttributes<SystemHistories>> {
  declare id: CreationOptional<string>
  declare systemId: ForeignKey<Systems['id']>
  declare population: number
  declare systemGovernment: string
  declare systemAllegiance: string
  declare systemSecurity: string
  declare systemEconomy: string
  declare systemSecondEconomy: string
  declare systemFactionId: ForeignKey<Factions['id']>
  declare systemFactionState: string
  declare validFrom: Date
  declare validTo: Date

  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export function SystemHistoriesInit(sequelize: Sequelize) {
  SystemHistories.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      systemId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      population: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get() {
          return parseInt(this.getDataValue('population').toString())
        },
      },
      systemGovernment: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      systemAllegiance: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      systemSecurity: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      systemEconomy: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      systemSecondEconomy: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      systemFactionId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      systemFactionState: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      validFrom: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      validTo: {
        type: DataTypes.DATE,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'system_histories',
      underscored: true,
      indexes: [
        {
          fields: ['valid_from'],
        },
      ],
    },
  )
}
