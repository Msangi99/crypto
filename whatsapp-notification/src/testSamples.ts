import type { NotifyPayload } from './types.js';

export type SampleId =
  | 'new_user'
  | 'withdrawal_request'
  | 'deposit_request_treasury'
  | 'deposit_request_pool'
  | 'deposit_confirmed_manual'
  | 'deposit_confirmed_auto'
  | 'deposit_confirmed_pool'
  | 'payment_mining'
  | 'payment_pool_claim'
  | 'payment_transfer'
  | 'payment_portfolio_sync'
  | 'loan_request'
  | 'loan_credit_line';

export interface NotifySample {
  id: SampleId;
  label: string;
  page: string;
  payload: NotifyPayload;
}

export function getNotifySamples(dashboardUrl: string): NotifySample[] {
  const base = dashboardUrl.replace(/\/$/, '');

  return [
    {
      id: 'new_user',
      label: 'New user',
      page: '/users',
      payload: {
        event: 'NEW_USER',
        title: 'New user registered',
        message: 'Account created for *demo_trader*.',
        url: `${base}/users/demo-user-id`,
        metadata: { Wallet: '0x1a2b3c4d5e…' },
      },
    },
    {
      id: 'withdrawal_request',
      label: 'Withdrawal request',
      page: '/withdrawals',
      payload: {
        event: 'WITHDRAWAL_REQUEST',
        title: 'New withdrawal request',
        message: '*demo_trader* requested *125.500000 USDT* withdrawal.',
        url: `${base}/withdrawals`,
        metadata: { Token: 'USDT', Amount: 130, Net: '125.500000', To: '0xabcd1234…ef90' },
      },
    },
    {
      id: 'deposit_request_treasury',
      label: 'Treasury deposit request',
      page: '/deposit-requests',
      payload: {
        event: 'DEPOSIT_REQUEST',
        title: 'New deposit request',
        message: '*demo_trader* requested *$250.00 USDT* deposit.',
        url: `${base}/deposit-requests`,
        metadata: { Amount: '$250.00', Chain: 'BSC' },
      },
    },
    {
      id: 'deposit_request_pool',
      label: 'Pool deposit (pending)',
      page: '/deposits',
      payload: {
        event: 'DEPOSIT_REQUEST',
        title: 'New pool deposit (pending)',
        message: '*demo_trader* staked *500* in *Gold Pool* — needs review.',
        url: `${base}/deposits`,
        metadata: { Pool: 'Gold Pool', Amount: 500 },
      },
    },
    {
      id: 'deposit_confirmed_manual',
      label: 'Confirm deposit (txHash)',
      page: '/deposit-requests',
      payload: {
        event: 'DEPOSIT_CONFIRMED',
        title: 'Deposit confirmed',
        message: '*demo_trader* — *$100.00* credited (manual txHash confirm).',
        url: `${base}/deposit-requests`,
        metadata: { Amount: '$100.00', Source: 'manual txHash confirm', Tx: '0x9f8e7d6c…' },
      },
    },
    {
      id: 'deposit_confirmed_auto',
      label: 'Treasury auto-credit',
      page: '/deposit-requests',
      payload: {
        event: 'DEPOSIT_CONFIRMED',
        title: 'Deposit confirmed',
        message: '*demo_trader* — *$75.00* credited (treasury auto-detect).',
        url: `${base}/deposit-requests`,
        metadata: { Amount: '$75.00', Source: 'treasury auto-detect', Tx: '0xabc12345…' },
      },
    },
    {
      id: 'deposit_confirmed_pool',
      label: 'Pool deposit confirmed',
      page: '/deposits',
      payload: {
        event: 'DEPOSIT_CONFIRMED',
        title: 'Pool deposit confirmed',
        message: '*demo_trader* joined *Gold Pool* with *500*.',
        url: `${base}/deposits`,
        metadata: { Pool: 'Gold Pool', Amount: 500 },
      },
    },
    {
      id: 'payment_mining',
      label: 'Mining package buy',
      page: '/payments',
      payload: {
        event: 'PAYMENT',
        title: 'Payment · FEE',
        message: '*demo_trader* — Mining package "Pro Miner" activated ($49.99).',
        url: `${base}/payments`,
        metadata: { Type: 'FEE', Amount: '49.99', Status: 'SUCCESS' },
      },
    },
    {
      id: 'payment_pool_claim',
      label: 'Pool claim fee',
      page: '/payments',
      payload: {
        event: 'PAYMENT',
        title: 'Payment · DEPOSIT',
        message: '*demo_trader* — Pool claim fee for Gold Pool (loan credit $1000.00).',
        url: `${base}/payments`,
        metadata: { Type: 'DEPOSIT', Amount: '50.00', Status: 'SUCCESS' },
      },
    },
    {
      id: 'payment_transfer',
      label: 'Token transfer',
      page: '/payments',
      payload: {
        event: 'PAYMENT',
        title: 'Payment · TRANSFER',
        message: '*demo_trader* — Internal CLB transfer 200.00 → 0x9876543210…',
        url: `${base}/payments`,
        metadata: { Type: 'TRANSFER', Amount: '200.00', Status: 'SUCCESS' },
      },
    },
    {
      id: 'payment_portfolio_sync',
      label: 'Portfolio sync',
      page: '/payments',
      payload: {
        event: 'PAYMENT',
        title: 'Payment · REWARD',
        message: '*demo_trader* — Portfolio sync — minted 1500.00 CLB ($150.00).',
        url: `${base}/payments`,
        metadata: { Type: 'REWARD', Amount: '1500.00', Status: 'SUCCESS', Tx: '0xdeadbeef…' },
      },
    },
    {
      id: 'loan_request',
      label: 'Loan request',
      page: '/users',
      payload: {
        event: 'LOAN_REQUEST',
        title: 'New loan request',
        message: '*demo_trader* — 0.5 BNB collateral, 120.00 loan pending.',
        url: `${base}/users/demo-user-id`,
        metadata: { Collateral: '0.5 BNB', Amount: '120.00', 'Loan ID': 'a1b2c3d4' },
      },
    },
    {
      id: 'loan_credit_line',
      label: 'Credit line request',
      page: '/users',
      payload: {
        event: 'LOAN_REQUEST',
        title: 'New credit line request',
        message: '*demo_trader* — 1.0 ETH collateral, 800.00 credit limit pending.',
        url: `${base}/users/demo-user-id`,
        metadata: { Collateral: '1.0 ETH', Amount: '800.00', 'Loan ID': 'e5f6g7h8' },
      },
    },
  ];
}

export function getSample(id: string, dashboardUrl: string): NotifySample | undefined {
  return getNotifySamples(dashboardUrl).find((s) => s.id === id);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendAllSamples(
  dashboardUrl: string,
  send: (payload: NotifyPayload) => Promise<{ ok: boolean; error?: string }>,
  gapMs = 3000,
): Promise<{ sent: number; failed: string[] }> {
  const samples = getNotifySamples(dashboardUrl);
  const failed: string[] = [];
  let sent = 0;

  for (const sample of samples) {
    const result = await send(sample.payload);
    if (result.ok) sent += 1;
    else failed.push(`${sample.id}: ${result.error ?? 'unknown'}`);
    if (gapMs > 0) await sleep(gapMs);
  }

  return { sent, failed };
}
