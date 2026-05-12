#!/usr/bin/env node

// Treasury Deposit Monitor Script
// Run this script via cron to auto-detect and credit USDT deposits
// Example cron: */2 * * * * /usr/bin/node /path/to/CLB/scripts/monitor-deposits.js

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('ERROR: ADMIN_TOKEN environment variable is required');
  process.exit(1);
}

async function monitorDeposits() {
  try {
    const response = await fetch(`${API_URL}/api/credit-wallet/monitor-deposits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[${new Date().toISOString()}] Deposit monitor completed:`, {
        processed: data.processed,
        errors: data.errors.length,
      });
      if (data.errors.length > 0) {
        console.error('Errors:', data.errors);
      }
    } else {
      console.error(`[${new Date().toISOString()}] Deposit monitor failed:`, data.error);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Deposit monitor error:`, error.message);
  }
}

monitorDeposits();
