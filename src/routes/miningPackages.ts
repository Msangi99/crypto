import { FastifyInstance } from 'fastify';
import prisma from '../config/db';
import type { ClbMiningPackage } from '@prisma/client';

export function serializeMiningPackage(p: ClbMiningPackage) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tokenSymbol: p.tokenSymbol,
    tokensPerPeriod: Number(p.tokensPerPeriod),
    periodLength: p.periodLength,
    periodUnit: p.periodUnit,
    isFree: p.isFree,
    priceUsd: p.isFree ? null : p.priceUsd != null ? Number(p.priceUsd) : null,
    sortOrder: p.sortOrder,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export default async function miningPackageRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    const rows = await prisma.clbMiningPackage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return {
      success: true,
      packages: rows.map(serializeMiningPackage),
    };
  });
}
