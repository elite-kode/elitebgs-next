import type { CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize'
import { DataTypes, Model, Sequelize } from 'sequelize'
import { SystemFactionHistories } from './system_faction_histories.ts'

export class PendingStates extends Model<InferAttributes<PendingStates>, InferCreationAttributes<PendingStates>> {
  declare id: CreationOptional<string>
  declare state: string
  declare trend: number
  declare systemFactionId: ForeignKey<SystemFactionHistories['id']>

  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export function PendingStatesInit(sequelize: Sequelize) {
  PendingStates.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      systemFactionId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      trend: {
        type: DataTypes.DECIMAL,
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
    { sequelize, tableName: 'pending_states', underscored: true },
  )
}
