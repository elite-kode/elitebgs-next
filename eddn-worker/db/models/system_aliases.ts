import type { CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize'
import { DataTypes, Model, Sequelize } from 'sequelize'
import { Systems } from './systems.ts'

export class SystemAliases extends Model<InferAttributes<SystemAliases>, InferCreationAttributes<SystemAliases>> {
  declare id: CreationOptional<string>
  declare systemId: ForeignKey<Systems['id']>
  declare alias: string
  declare aliasLower: string
  declare createdAt: CreationOptional<Date>
}

export function SystemAliasesInit(sequelize: Sequelize) {
  SystemAliases.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      systemId: {
        type: DataTypes.UUID,
      },
      alias: {
        type: DataTypes.STRING,
      },
      aliasLower: {
        type: DataTypes.STRING,
      },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'system_aliases',
      timestamps: true,
      updatedAt: false,
      underscored: true,
    },
  )
}
