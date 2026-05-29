function env(key: string, fallback = ''): string {
  const v = process.env[key];
  return v && v.trim() !== '' ? v.trim() : fallback;
}

export const config = {
  port: parseInt(env('PORT', '8080'), 10),
  host: env('HOST', '0.0.0.0'),
  authDir: env('WHATSAPP_AUTH_DIR', './auth_state'),
  /** E.164 digits only, e.g. 255712345678 (no +). Used when messaging a separate admin number. */
  adminWhatsAppNumber: env('ADMIN_WHATSAPP_NUMBER'),
  /** Shared secret — backend sends X-Notify-Secret header. */
  notifySecret: env('WHATSAPP_NOTIFY_SECRET'),
  adminDashboardUrl: env('ADMIN_DASHBOARD_URL', 'https://cryptoloanboost.com/dashboard'),
};
