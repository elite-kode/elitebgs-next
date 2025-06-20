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
import { SystemHistories } from './system_histories.ts'
import { SystemFactions } from './system_factions.ts'

export class Systems extends Model<
  InferAttributes<Systems, { omit: 'SystemAliases' }>,
  InferCreationAttributes<Systems, { omit: 'SystemAliases' }>
> {
  declare id: CreationOptional<string>
  declare starSystem: string
  declare starSystemLower: string
  declare systemAddress: string
  declare starPos: PointWCrs

  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare SystemAliases?: NonAttribute<SystemAliases[]>
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

  declare SystemHistories?: NonAttribute<SystemHistories[]>
  declare getSystemHistories: HasManyGetAssociationsMixin<SystemHistories>
  declare createSystemHistory: HasManyCreateAssociationMixin<SystemHistories, 'systemId'>

  declare SystemFactions?: NonAttribute<SystemFactions[]>

  declare static associations: {
    SystemAliases: Association<Systems, SystemAliases>
    SystemHistory: Association<Systems, SystemHistories>
    SystemFactions: Association<Systems, SystemFactions>
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
        allowNull: false,
      },
      starSystemLower: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      systemAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      starPos: {
        type: DataTypes.GEOMETRY('POINTZ', 0),
        allowNull: false,
      },
      // Needed to mute the typing error as sequelize can't figure it out.
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
      tableName: 'systems',
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['system_address'],
        },
      ],
    },
  )
}
