import type { AdminNotifyEvent, NotifyPayload } from './types.js';

type EventStyle = {
  icon: string;
  banner: string;
  tagline: string;
  page: string;
  divider: string;
};

const EVENT_STYLES: Record<AdminNotifyEvent, EventStyle> = {
  NEW_USER: {
    icon: '👤',
    banner: 'NEW MEMBER',
    tagline: 'Fresh account — welcome to CLB',
    page: 'Users',
    divider: '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰',
  },
  WITHDRAWAL_REQUEST: {
    icon: '💸',
    banner: 'WITHDRAWAL QUEUED',
    tagline: 'Manual review before payout',
    page: 'Withdrawals',
    divider: '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰',
  },
  DEPOSIT_REQUEST: {
    icon: '📥',
    banner: 'DEPOSIT INCOMING',
    tagline: 'Awaiting confirmation or review',
    page: 'Deposits',
    divider: '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰',
  },
  DEPOSIT_CONFIRMED: {
    icon: '✅',
    banner: 'DEPOSIT CREDITED',
    tagline: 'Funds successfully added',
    page: 'Deposit requests',
    divider: '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰',
  },
  PAYMENT: {
    icon: '💳',
    banner: 'PAYMENT ACTIVITY',
    tagline: 'New transaction on platform',
    page: 'Payments',
    divider: '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰',
  },
  LOAN_REQUEST: {
    icon: '🏦',
    banner: 'LOAN APPLICATION',
    tagline: 'Collateral pending review',
    page: 'Users · Loans',
    divider: '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰',
  },
  GENERAL: {
    icon: '🔔',
    banner: 'CLB ADMIN',
    tagline: 'System notification',
    page: 'Dashboard',
    divider: '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰',
  },
};

function paymentAccent(metadata?: NotifyPayload['metadata']): Partial<EventStyle> {
  const type = String(metadata?.Type ?? '').toUpperCase();
  switch (type) {
    case 'FEE':
      return { icon: '⛏️', banner: 'MINING PAYMENT', tagline: 'Package activation fee' };
    case 'DEPOSIT':
      return { icon: '🏊', banner: 'POOL CLAIM FEE', tagline: 'In-app credit stake' };
    case 'TRANSFER':
      return { icon: '↔️', banner: 'TOKEN TRANSFER', tagline: 'Internal CLB movement' };
    case 'REWARD':
      return { icon: '🎁', banner: 'PORTFOLIO SYNC', tagline: 'CLB minted to wallet' };
    default:
      return {};
  }
}

function depositRequestAccent(metadata?: NotifyPayload['metadata']): Partial<EventStyle> {
  if (metadata?.Pool) {
    return { icon: '🏊', banner: 'POOL STAKE PENDING', tagline: 'On-chain deposit needs review', page: 'Pool deposits' };
  }
  if (metadata?.Chain) {
    return { icon: '🏛️', banner: 'TREASURY DEPOSIT', tagline: 'USDT receive request', page: 'Deposit requests' };
  }
  return {};
}

function depositConfirmedAccent(metadata?: NotifyPayload['metadata']): Partial<EventStyle> {
  if (metadata?.Pool) {
    return { icon: '🏊', banner: 'POOL JOINED', tagline: 'Stake confirmed', page: 'Pool deposits' };
  }
  const source = String(metadata?.Source ?? '');
  if (source.includes('auto')) {
    return { icon: '🤖', banner: 'AUTO-CREDIT', tagline: 'Treasury monitor detected USDT', page: 'Deposit requests' };
  }
  if (source.includes('manual') || source.includes('txHash')) {
    return { icon: '🔗', banner: 'TX CONFIRMED', tagline: 'User submitted txHash', page: 'Deposit requests' };
  }
  return {};
}

function loanAccent(title: string): Partial<EventStyle> {
  if (title.toLowerCase().includes('credit line')) {
    return { icon: '📊', banner: 'CREDIT LINE', tagline: 'Dynamic limit request', page: 'Users · Credit line' };
  }
  return {};
}

function resolveStyle(payload: NotifyPayload): EventStyle {
  const base = { ...EVENT_STYLES[payload.event] };
  let extra: Partial<EventStyle> = {};

  if (payload.event === 'PAYMENT') extra = paymentAccent(payload.metadata);
  else if (payload.event === 'DEPOSIT_REQUEST') extra = depositRequestAccent(payload.metadata);
  else if (payload.event === 'DEPOSIT_CONFIRMED') extra = depositConfirmedAccent(payload.metadata);
  else if (payload.event === 'LOAN_REQUEST') extra = loanAccent(payload.title);

  return { ...base, ...extra };
}

function formatMetadata(metadata?: NotifyPayload['metadata']): string[] {
  if (!metadata) return [];
  const lines: string[] = ['', '📋 *Details*'];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null || value === '') continue;
    lines.push(`   ▸ *${key}:* ${value}`);
  }
  return lines;
}

export function formatNotifyText(payload: NotifyPayload, dashboardFallback: string): string {
  const style = resolveStyle(payload);
  const link = payload.url || dashboardFallback;
  const lines: string[] = [
    `${style.icon} *${style.banner}*`,
    style.divider,
    `_${style.tagline}_`,
    '',
    payload.message,
    ...formatMetadata(payload.metadata),
    '',
    `📍 *Admin page:* ${style.page}`,
    `🔗 ${link}`,
    '',
    `_CLB · ${new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}_`,
  ];
  return lines.join('\n');
}
