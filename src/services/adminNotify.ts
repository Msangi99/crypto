import { env } from '../config/env';

export type AdminNotifyEvent =
  | 'WITHDRAWAL_REQUEST'
  | 'DEPOSIT_REQUEST'
  | 'NEW_USER'
  | 'PAYMENT'
  | 'DEPOSIT_CONFIRMED'
  | 'LOAN_REQUEST'
  | 'GENERAL';

export interface AdminNotifyPayload {
  event: AdminNotifyEvent;
  title: string;
  message: string;
  url?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export type AdminUserRef = {
  id?: string;
  username?: string | null;
  email?: string | null;
  walletAddress?: string | null;
};

function userDisplay(user: AdminUserRef): string {
  return user.username || user.email || user.walletAddress || user.id || 'Unknown user';
}

function fmtUsd(n: number | string): string {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v.toFixed(2);
}

/** Fire-and-forget WhatsApp alert to admin (no-op if notify URL/secret unset). */
export function notifyAdmin(payload: AdminNotifyPayload): void {
  const base = env.WHATSAPP_NOTIFY_URL.replace(/\/$/, '');
  const secret = env.WHATSAPP_NOTIFY_SECRET;
  if (!base || !secret) return;

  void fetch(`${base}/api/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Notify-Secret': secret,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn('[adminNotify] failed:', err instanceof Error ? err.message : err);
  });
}

export function notifyNewUserRegistered(user: AdminUserRef & { id: string }): void {
  notifyAdmin({
    event: 'NEW_USER',
    title: 'New user registered',
    message: `Account created for ${userDisplay(user)}.`,
    url: `${env.ADMIN_DASHBOARD_URL}/users/${user.id}`,
    metadata: {
      Wallet: user.walletAddress ? `${user.walletAddress.slice(0, 10)}…` : '—',
    },
  });
}

export function notifyDepositConfirmed(params: {
  user: AdminUserRef;
  amountUsd: number | string;
  txHash?: string | null;
  source: string;
  adminPath?: string;
}): void {
  notifyAdmin({
    event: 'DEPOSIT_CONFIRMED',
    title: 'Deposit confirmed',
    message: `${userDisplay(params.user)} — $${fmtUsd(params.amountUsd)} credited (${params.source}).`,
    url: `${env.ADMIN_DASHBOARD_URL}${params.adminPath ?? '/deposit-requests'}`,
    metadata: {
      Amount: `$${fmtUsd(params.amountUsd)}`,
      Source: params.source,
      ...(params.txHash ? { Tx: `${params.txHash.slice(0, 10)}…` } : {}),
    },
  });
}

export function notifyPoolDeposit(params: {
  user: AdminUserRef;
  poolName: string;
  amount: number;
  status: 'PENDING' | 'CONFIRMED';
}): void {
  if (params.status === 'PENDING') {
    notifyAdmin({
      event: 'DEPOSIT_REQUEST',
      title: 'New pool deposit (pending)',
      message: `${userDisplay(params.user)} staked ${params.amount} in ${params.poolName} — needs review.`,
      url: `${env.ADMIN_DASHBOARD_URL}/deposits`,
      metadata: { Pool: params.poolName, Amount: params.amount },
    });
    return;
  }

  notifyAdmin({
    event: 'DEPOSIT_CONFIRMED',
    title: 'Pool deposit confirmed',
    message: `${userDisplay(params.user)} joined ${params.poolName} with ${params.amount}.`,
    url: `${env.ADMIN_DASHBOARD_URL}/deposits`,
    metadata: { Pool: params.poolName, Amount: params.amount },
  });
}

export function notifyAdminPayment(params: {
  user: AdminUserRef;
  txType: string;
  amount: number | string;
  status?: string;
  detail: string;
  txHash?: string | null;
}): void {
  notifyAdmin({
    event: 'PAYMENT',
    title: `Payment · ${params.txType}`,
    message: `${userDisplay(params.user)} — ${params.detail}`,
    url: `${env.ADMIN_DASHBOARD_URL}/payments`,
    metadata: {
      Type: params.txType,
      Amount: fmtUsd(params.amount),
      ...(params.status ? { Status: params.status } : {}),
      ...(params.txHash ? { Tx: `${params.txHash.slice(0, 10)}…` } : {}),
    },
  });
}

export function notifyLoanRequest(params: {
  user: AdminUserRef & { id: string };
  loanId: string;
  kind: 'fixed' | 'credit_line';
  loanAmount: number;
  collateralChain: string;
  collateralAmount: number;
}): void {
  const title = params.kind === 'credit_line' ? 'New credit line request' : 'New loan request';
  notifyAdmin({
    event: 'LOAN_REQUEST',
    title,
    message: `${userDisplay(params.user)} — ${params.collateralAmount} ${params.collateralChain} collateral, ${params.loanAmount.toFixed(2)} ${params.kind === 'credit_line' ? 'credit limit' : 'loan'} pending.`,
    url: `${env.ADMIN_DASHBOARD_URL}/users/${params.user.id}`,
    metadata: {
      Collateral: `${params.collateralAmount} ${params.collateralChain}`,
      Amount: params.loanAmount.toFixed(2),
      'Loan ID': params.loanId.slice(0, 8),
    },
  });
}
