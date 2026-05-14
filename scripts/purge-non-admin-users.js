/**
 * Deletes every user with role USER and all rows that reference those users.
 * Keeps: ADMIN and MODERATOR accounts, pools, platform_settings, clb_mining_packages, mobile_app_releases.
 *
 * IRREVERSIBLE. Point DATABASE_URL at the database you intend to change.
 *
 * Usage:
 *   CONFIRM_PURGE=yes node scripts/purge-non-admin-users.js
 *
 * Preview (no deletes):
 *   DRY_RUN=1 node scripts/purge-non-admin-users.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  if (!dryRun && process.env.CONFIRM_PURGE !== 'yes') {
    console.error(
      'Refusing to run: set CONFIRM_PURGE=yes to execute deletes, or DRY_RUN=1 to preview counts only.',
    );
    process.exit(1);
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, walletAddress: true },
  });
  if (admins.length === 0) {
    console.error('No user with role ADMIN found. Aborting so you are not locked out.');
    process.exit(1);
  }
  console.log(`Found ${admins.length} ADMIN user(s) (always kept):`);
  admins.forEach((a) => console.log(`  - ${a.id}  email=${a.email ?? '—'}  wallet=${a.walletAddress}`));

  const userRoleTargets = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true, walletAddress: true, email: true },
  });
  const ids = userRoleTargets.map((u) => u.id);
  console.log(`\nUsers with role USER to remove: ${ids.length}`);
  if (ids.length > 0 && ids.length <= 20) {
    userRoleTargets.forEach((u) => console.log(`  - ${u.id}  ${u.email ?? '—'}  ${u.walletAddress}`));
  } else if (ids.length > 20) {
    console.log('  (more than 20 — listing skipped)');
  }

  if (ids.length === 0) {
    const byRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });
    console.log('\nNothing to delete. Current users by role:');
    byRole.forEach((r) => console.log(`  ${r.role}: ${r._count.id}`));
    console.log(
      '\nIf you expected USER rows here, your DATABASE_URL may point at a different DB than production, or every wallet account is ADMIN/MODERATOR in this database.',
    );
    return;
  }

  if (dryRun) {
    const [deposits, loans, referrals, members, txs, notifs, wds, tb, tt, subs, draws] = await Promise.all([
      prisma.deposit.count({ where: { userId: { in: ids } } }),
      prisma.loan.count({ where: { userId: { in: ids } } }),
      prisma.referral.count({
        where: { OR: [{ referrerId: { in: ids } }, { referredId: { in: ids } }] },
      }),
      prisma.poolMember.count({ where: { userId: { in: ids } } }),
      prisma.transaction.count({ where: { userId: { in: ids } } }),
      prisma.notification.count({ where: { userId: { in: ids } } }),
      prisma.withdrawal.count({ where: { userId: { in: ids } } }),
      prisma.tokenBalance.count({ where: { userId: { in: ids } } }),
      prisma.tokenTransfer.count({
        where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] },
      }),
      prisma.userMiningSubscription.count({ where: { userId: { in: ids } } }),
      prisma.creditDraw.count({ where: { userId: { in: ids } } }),
    ]);
    console.log('\nDRY_RUN — rows that would be deleted or affected:');
    console.log({
      deposits,
      loans,
      referrals,
      poolMembers: members,
      transactions: txs,
      notifications: notifs,
      withdrawals: wds,
      tokenBalances: tb,
      tokenTransfers: tt,
      miningSubscriptions: subs,
      creditDraws_user: draws,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const loans = await tx.loan.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const loanIds = loans.map((l) => l.id);

    if (loanIds.length > 0) {
      await tx.creditDraw.deleteMany({ where: { loanId: { in: loanIds } } });
      await tx.deposit.updateMany({
        where: { loanId: { in: loanIds } },
        data: { loanId: null },
      });
      await tx.loan.deleteMany({ where: { id: { in: loanIds } } });
    }

    await tx.creditDraw.deleteMany({ where: { userId: { in: ids } } });
    await tx.deposit.deleteMany({ where: { userId: { in: ids } } });

    await tx.tokenTransfer.deleteMany({
      where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] },
    });

    await tx.withdrawal.deleteMany({ where: { userId: { in: ids } } });
    await tx.notification.deleteMany({ where: { userId: { in: ids } } });
    await tx.transaction.deleteMany({ where: { userId: { in: ids } } });
    await tx.poolMember.deleteMany({ where: { userId: { in: ids } } });

    await tx.referral.deleteMany({
      where: { OR: [{ referrerId: { in: ids } }, { referredId: { in: ids } }] },
    });

    await tx.tokenBalance.deleteMany({ where: { userId: { in: ids } } });
    await tx.userMiningSubscription.deleteMany({ where: { userId: { in: ids } } });

    const del = await tx.user.deleteMany({ where: { id: { in: ids }, role: 'USER' } });
    console.log(`\nDeleted ${del.count} user row(s) with role USER.`);
  });

  console.log('Done. ADMIN / MODERATOR users and platform tables are unchanged.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
