import { Transaction } from 'sequelize'
import { type FSDJump } from '@elitebgs/types/eddn.ts'
import { Systems } from '../models/systems.ts'

export function findSystem(systemAddress: number, transaction: Transaction) {
  return Systems.findOne({
    where: { systemAddress: systemAddress.toString() },
    transaction,
  })
}

export function createSystem(messageBody: FSDJump['message'], transaction: Transaction) {
  return Systems.create(
    {
      starSystem: messageBody.StarSystem,
      starSystemLower: messageBody.StarSystem.toLowerCase(),
      systemAddress: messageBody.SystemAddress.toString(),
      starPos: {
        type: 'Point',
        coordinates: messageBody.StarPos,
        crs: { type: 'name', properties: { name: '0' } },
      },
    },
    {
      transaction,
    },
  )
}

export function updateSystemName(systemId: string, newStarSystemName: string, transaction: Transaction) {
  return Systems.update(
    {
      starSystem: newStarSystemName,
      starSystemLower: newStarSystemName.toLowerCase(),
    },
    {
      where: { id: systemId },
      transaction,
    },
  )
}
