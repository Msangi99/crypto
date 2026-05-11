/**
 * In-app ledger naming (do not mix these up in UI):
 * - Deposit wallet = USDT balance credited after treasury deposit confirm (depositCreditUsd).
 *   This is what users “see” after they deposit — same bucket the API calls deposit credit.
 * - Loan credit = balance after pool Claim (claimedPoolCreditUsd), not the same as deposit wallet.
 * - Swapped hold = swap / position bucket (swapHoldingsUsd or positions).
 *
 * “Credit wallet” in code = API module name only; prefer user-facing “Deposit wallet” / “Loan credit”.
 */
export const CreditWalletCopy = {
  depositTabShort: 'Deposit',
  depositTabFull: 'Deposit wallet (USDT)',
  depositHint:
    'This is the USDT you sent and confirmed in the app - this is where your deposit appears. It is not loan credit.',

  loanTabShort: 'Loan',
  loanTabFull: 'Loan credit',
  loanHint: 'Balance after claiming from a pool - use "Use your loan".',

  swapTabShort: 'Swapped',
  swapTabFull: 'Swapped hold',

  poolsDepositLine: 'Deposit wallet (USDT)',
  poolsSubtitle:
    'Claim fee is taken from Deposit wallet only (Loan credit is not used for this fee). After Claim, your Loan credit increases in the Loan tab.',

  poolDetailDepositStat: 'Deposit for fee',
} as const;
