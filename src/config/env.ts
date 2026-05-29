import dotenv from 'dotenv';
const exampleEnv = dotenv.config({ path: '.env.example' }).parsed ?? {};
dotenv.config({ override: true });

function envValue(key: string, fallback = ''): string {
  const value = process.env[key];
  if (value && value.trim() !== '') return value;
  return exampleEnv[key] || fallback;
}

export const env = {
  // Server
  PORT: parseInt(envValue('PORT', '3000'), 10),
  HOST: envValue('HOST', '0.0.0.0'),
  NODE_ENV: envValue('NODE_ENV', 'development'),

  // Database
  DATABASE_URL: envValue('DATABASE_URL'),

  // JWT
  JWT_SECRET: envValue('JWT_SECRET', 'fallback-secret-change-me'),

  /** Comma-separated extra browser origins allowed for CORS (e.g. https://preview.vercel.app). */
  CORS_EXTRA_ORIGINS: envValue('CORS_EXTRA_ORIGINS', ''),

  // Blockchain
  BSC_RPC_URL: envValue('BSC_RPC_URL', 'https://bsc-dataseed1.binance.org'),
  BSC_TESTNET_RPC_URL: envValue('BSC_TESTNET_RPC_URL', 'https://data-seed-prebsc-1-s1.binance.org:8545'),
  CHAIN_ID: parseInt(envValue('CHAIN_ID', '97'), 10),
  /** BEP-20 USDT contract (mainnet / testnet default by CHAIN_ID). Overridable in admin Platform Settings. */
  USDT_BEP20_ADDRESS: envValue(
    'USDT_BEP20_ADDRESS',
    parseInt(envValue('CHAIN_ID', '97'), 10) === 56
      ? '0x55d398326f99059fF775485246099027B3197955'
      : '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'
  ),
  /** Min block confirmations before crediting treasury USDT deposits. */
  USDT_DEPOSIT_MIN_CONFIRMATIONS: parseInt(
    envValue('USDT_DEPOSIT_MIN_CONFIRMATIONS', parseInt(envValue('CHAIN_ID', '97'), 10) === 56 ? '12' : '3'),
    10
  ),
  /** Minimum USDT deposit amount in USD (default: 10). Admin can override in settings. */
  USDT_DEPOSIT_MIN_USD: parseFloat(envValue('USDT_DEPOSIT_MIN_USD', '10')),
  POOL_MANAGER_CONTRACT: envValue('POOL_MANAGER_CONTRACT'),
  PRIVATE_KEY: envValue('PRIVATE_KEY'),
  CLB_TOKEN_ADDRESS: envValue('CLB_TOKEN_ADDRESS'),
  /** Absolute path to CLBToken.json on the server (production VPS / Docker). */
  CLB_TOKEN_ABI_PATH: envValue('CLB_TOKEN_ABI_PATH'),

  // Price Feed (optional PRO key → header x-cg-pro-api-key on requests)
  COINGECKO_API_URL: envValue('COINGECKO_API_URL', 'https://api.coingecko.com/api/v3'),
  COINGECKO_API_KEY: envValue('COINGECKO_API_KEY'),

  /** Internal URL of whatsapp-notification container, e.g. http://whatsapp-notification:8080 */
  WHATSAPP_NOTIFY_URL: envValue('WHATSAPP_NOTIFY_URL', ''),
  WHATSAPP_NOTIFY_SECRET: envValue('WHATSAPP_NOTIFY_SECRET', ''),
  ADMIN_DASHBOARD_URL: envValue('ADMIN_DASHBOARD_URL', 'https://cryptoloanboost.com/dashboard'),
} as const;
