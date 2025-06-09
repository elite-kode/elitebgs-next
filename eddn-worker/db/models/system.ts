import {
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  DataTypes,
  Model,
  Sequelize,
} from 'sequelize'
import { type PointWCrs } from '@elitebgs/types/geoJson.ts'

export class System extends Model<InferAttributes<System>, InferCreationAttributes<System>> {
  declare id: CreationOptional<string>
  declare starSystem: string
  declare starSystemLower: string
  declare systemAddress: string
  declare starPos: PointWCrs
}

export function SystemInit(sequelize: Sequelize) {
  System.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      starSystem: {
        type: DataTypes.STRING,
      },
      starSystemLower: {
        type: DataTypes.STRING,
      },
      systemAddress: {
        type: DataTypes.STRING,
      },
      starPos: {
        type: DataTypes.GEOMETRY('POINTZ', 0),
      },
    },
    { sequelize, modelName: 'system' },
  )
}
