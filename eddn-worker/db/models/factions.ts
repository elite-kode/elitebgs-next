import type {
  CreationOptional,
  HasManyCreateAssociationMixin,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize'
import { DataTypes, Model, Sequelize } from 'sequelize'
import { SystemFactions } from './system_factions.ts'

export class Factions extends Model<InferAttributes<Factions>, InferCreationAttributes<Factions>> {
  declare id: CreationOptional<string>
  declare name: string
  declare nameLower: string
  declare government: string
  declare allegiance: string

  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare createFactionHistory: HasManyCreateAssociationMixin<SystemFactions, 'factionId'>
}

export function FactionsInit(sequelize: Sequelize) {
  Factions.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nameLower: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      government: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      allegiance: {
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
    { sequelize, tableName: 'factions', underscored: true },
  )
}
