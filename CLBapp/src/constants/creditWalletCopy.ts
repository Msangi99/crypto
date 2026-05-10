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
    'Ni USDT uliotuma na kuthibitishwa ndani ya app — hapa ndipo deposit inaonekana. Si loan credit.',

  loanTabShort: 'Loan',
  loanTabFull: 'Loan credit',
  loanHint: 'Salio baada ya Claim kwenye pool — tumia “Use your loan”.',

  swapTabShort: 'Swapped',
  swapTabFull: 'Swapped hold',

  poolsDepositLine: 'Deposit wallet (USDT)',
  poolsSubtitle:
    'Ada ya Claim inatolewa kwa Deposit wallet pekee (Loan credit haitumiwi kwa ada). Baada ya Claim unapata ongezeko la Loan credit kwenye tab ya Loan.',

  poolDetailDepositStat: 'Deposit kwa ada',
} as const;
