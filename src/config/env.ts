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

  // Blockchain
  BSC_RPC_URL: envValue('BSC_RPC_URL', 'https://bsc-dataseed1.binance.org'),
  BSC_TESTNET_RPC_URL: envValue('BSC_TESTNET_RPC_URL', 'https://data-seed-prebsc-1-s1.binance.org:8545'),
  CHAIN_ID: parseInt(envValue('CHAIN_ID', '97'), 10),
  POOL_MANAGER_CONTRACT: envValue('POOL_MANAGER_CONTRACT'),
  PRIVATE_KEY: envValue('PRIVATE_KEY'),
  CLB_TOKEN_ADDRESS: envValue('CLB_TOKEN_ADDRESS'),
  CLBG_TOKEN_ADDRESS: envValue('CLBG_TOKEN_ADDRESS'),
  CLBS_TOKEN_ADDRESS: envValue('CLBS_TOKEN_ADDRESS'),
  GLM_TOKEN_ADDRESS: envValue('GLM_TOKEN_ADDRESS'),

  // Price Feed (optional PRO key → header x-cg-pro-api-key on requests)
  COINGECKO_API_URL: envValue('COINGECKO_API_URL', 'https://api.coingecko.com/api/v3'),
  COINGECKO_API_KEY: envValue('COINGECKO_API_KEY'),
} as const;
