import type { CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize'
import { DataTypes, Model, Sequelize } from 'sequelize'
import { SystemFactions } from './system_factions.ts'

export class ActiveStates extends Model<InferAttributes<ActiveStates>, InferCreationAttributes<ActiveStates>> {
  declare id: CreationOptional<string>
  declare state: string
  declare systemFactionId: ForeignKey<SystemFactions['id']>

  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export function ActiveStatesInit(sequelize: Sequelize) {
  ActiveStates.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      systemFactionId: {
        type: DataTypes.UUID,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
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
    { sequelize, tableName: 'active_states', underscored: true },
  )
}
