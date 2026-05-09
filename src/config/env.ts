import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.example' });

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-change-me',

  // Blockchain
  BSC_RPC_URL: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
  BSC_TESTNET_RPC_URL: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
  CHAIN_ID: parseInt(process.env.CHAIN_ID || '97', 10),
  POOL_MANAGER_CONTRACT: process.env.POOL_MANAGER_CONTRACT || '',
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  CLB_TOKEN_ADDRESS: process.env.CLB_TOKEN_ADDRESS || '',
  CLBG_TOKEN_ADDRESS: process.env.CLBG_TOKEN_ADDRESS || '',
  CLBS_TOKEN_ADDRESS: process.env.CLBS_TOKEN_ADDRESS || '',

  // Price Feed (optional PRO key → header x-cg-pro-api-key on requests)
  COINGECKO_API_URL: process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3',
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '',
} as const;
