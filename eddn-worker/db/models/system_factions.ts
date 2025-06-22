import type { CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize'
import { DataTypes, Model, Sequelize } from 'sequelize'
import { Systems } from './systems.ts'
import { Factions } from './factions.ts'

export class SystemFactions extends Model<InferAttributes<SystemFactions>, InferCreationAttributes<SystemFactions>> {
  declare id: CreationOptional<string>
  declare systemId: ForeignKey<Systems['id']>
  declare factionId: ForeignKey<Factions['id']>
  declare factionState: string
  declare influence: number
  declare happiness: string
  declare validFrom: Date
  declare validTo: Date

  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export function SystemFactionsInit(sequelize: Sequelize) {
  SystemFactions.init(
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
      factionId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      factionState: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      influence: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      happiness: {
        type: DataTypes.STRING,
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
    { sequelize, tableName: 'system_factions', underscored: true },
  )
}
