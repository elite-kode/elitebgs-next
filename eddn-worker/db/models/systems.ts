import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManySetAssociationsMixin,
  HasManyRemoveAssociationMixin,
  HasManyRemoveAssociationsMixin,
  HasManyHasAssociationMixin,
  HasManyHasAssociationsMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  Association,
} from 'sequelize'
import { DataTypes, Model, Sequelize } from 'sequelize'
import { type PointWCrs } from '@elitebgs/types/geoJson.ts'
import { SystemAliases } from './system_aliases.ts'

export class Systems extends Model<
  InferAttributes<Systems, { omit: 'systemAliases' }>,
  InferCreationAttributes<Systems, { omit: 'systemAliases' }>
> {
  declare id: CreationOptional<string>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
  declare starSystem: string
  declare starSystemLower: string
  declare systemAddress: string
  declare starPos: PointWCrs

  declare systemAliases?: NonAttribute<SystemAliases[]>
  declare getSystemAliases: HasManyGetAssociationsMixin<SystemAliases>
  declare addSystemAlias: HasManyAddAssociationMixin<SystemAliases, string>
  declare addSystemAliases: HasManyAddAssociationsMixin<SystemAliases, string>
  declare setSystemAliases: HasManySetAssociationsMixin<SystemAliases, string>
  declare removeSystemAlias: HasManyRemoveAssociationMixin<SystemAliases, string>
  declare removeSystemAliases: HasManyRemoveAssociationsMixin<SystemAliases, string>
  declare hasSystemAlias: HasManyHasAssociationMixin<SystemAliases, string>
  declare hasSystemAliases: HasManyHasAssociationsMixin<SystemAliases, string>
  declare countSystemAliases: HasManyCountAssociationsMixin
  declare createSystemAlias: HasManyCreateAssociationMixin<SystemAliases, 'systemId'>

  declare static associations: {
    systemAliases: Association<Systems, SystemAliases>
  }
}

export function SystemsInit(sequelize: Sequelize) {
  Systems.init(
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
      // Needed to mute the typing error as sequelize can't figure it out
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: 'systems', underscored: true },
  )
}
