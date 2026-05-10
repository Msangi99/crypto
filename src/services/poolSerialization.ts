import type { Pool } from '@prisma/client';

type PoolWithCounts = Pool & {
  _count?: { members?: number; deposits?: number };
};

/**
 * Plain JSON for pool list/detail so clients always see booleans and numbers
 * (avoids Prisma Decimal / serializer quirks and strict OpenAPI response stripping).
 */
export function serializePoolPublic(p: PoolWithCounts): Record<string, unknown> {
  const minDeposit = Number(p.minDeposit);
  const memberCount = p._count?.members ?? 0;
  const depositsCount = p._count?.deposits;

  const row: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    description: p.description,
    contractAddress: p.contractAddress,
    tokenSymbol: p.tokenSymbol,
    minDeposit,
    maxDeposit: p.maxDeposit != null ? Number(p.maxDeposit) : null,
    apy: Number(p.apy),
    totalStaked: Number(p.totalStaked),
    status: p.status,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    supportsAppCredit: Boolean(p.supportsAppCredit),
    creditMinUsd: p.creditMinUsd != null ? Number(p.creditMinUsd) : null,
    creditCreditedUsd: p.creditCreditedUsd != null ? Number(p.creditCreditedUsd) : null,
    memberCount,
    _count: {
      members: memberCount,
      ...(depositsCount !== undefined ? { deposits: depositsCount } : {}),
    },
  };

  return row;
}
