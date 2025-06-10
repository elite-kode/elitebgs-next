import { SystemAliases } from '../models/system_aliases.ts'

export function findAliases(systemId: string){
  SystemAliases.findAll()
}