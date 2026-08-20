# Task 6 report — Central financial summary consumers

## Implemented

- `checkIn` now derives the exact pending balance from Stripe and external ledger movements, including refunds and pending refunds.
- Safe deletion rejects any Stripe or external movement and keeps the existing group-payment protection.
- Staff cancellation limits automatic refunds to net Stripe funds; external payments and adjustments remain ledger records.
- `solicitarPagoAction` acquires the reservation advisory lock, reloads the server-side ledger, and creates Checkout for the exact pending centavo amount. No client balance is accepted.
- Calendar read models now use `obtenerLedgerReserva` and show derived financial status, net paid amount, and exact pending balance.
- Guest consultation and cancellation use `calcularResumenFinanciero`, cap Stripe refunds at net Stripe funds, and expose external payments and external refunds/adjustments separately.

## TDD regressions

- Mixed Stripe + transfer permits check-in when the central balance is zero.
- A refund-reopened balance blocks check-in with the exact `$1,000` amount.
- Any external movement prevents hard deletion, even when net external value is zero.
- Staff cancellation refunds only net Stripe and does not synthesize an external refund.
- Payment requests recalculate under the advisory lock and charge only the central pending balance.
- Guest consultation exposes derived status, exact pending balance, net Stripe, external payments, and external refunds.
- Guest cancellation refunds only net Stripe and returns external movements separately.

## Verification

- Focused Vitest: 6 files passed, 11 tests passed.
- Targeted TypeScript check for Task 6 files and their dependencies: passed.
- Targeted ESLint for Task 6 files: passed.
- `git diff --check`: passed.

No full test suite, migrations, database operations, or live Stripe calls were run.
