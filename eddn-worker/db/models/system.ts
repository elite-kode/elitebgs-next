import { DataTypes, Model, Sequelize } from 'sequelize'

export class System extends Model {}

export function SystemInit(sequelize: Sequelize) {
  System.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
    },
    { sequelize, modelName: 'system' },
  )
}
