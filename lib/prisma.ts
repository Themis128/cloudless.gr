import { getPrismaClient } from '~/server/utils/prisma'

// Lazy initialization to avoid calling getPrismaClient at module load time
let _prisma: ReturnType<typeof getPrismaClient> | undefined

export const prisma = () => {
  if (!_prisma) {
    _prisma = getPrismaClient()
  }
  return _prisma
}

export default prisma