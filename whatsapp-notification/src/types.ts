export type AdminNotifyEvent =
  | 'WITHDRAWAL_REQUEST'
  | 'DEPOSIT_REQUEST'
  | 'NEW_USER'
  | 'PAYMENT'
  | 'DEPOSIT_CONFIRMED'
  | 'LOAN_REQUEST'
  | 'GENERAL';

export interface NotifyPayload {
  event: AdminNotifyEvent;
  title: string;
  message: string;
  url?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface ConnectionStatus {
  state: 'connecting' | 'open' | 'close' | 'qr';
  connected: boolean;
  hasQr: boolean;
  qrGeneratedAt: string | null;
  linkedUser: string | null;
}
