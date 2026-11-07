# myGroww

A private personal finance tracker for salaried people in India who support family and invest monthly. It answers one question first: how much is safe to spend?

## What it does

- **Safe to spend:** your salary, minus what has gone out, what is planned for family and SIPs, and what is unpaid on your card.
- **One ledger:** every number is calculated from one list of transactions, so pages cannot disagree.
- **No double counting:** card purchases count as spending when you buy. Card bills, SIPs, savings and transfers never do.
- **Two kinds of cycle:** salary cycles for budgets, and statement cycles for card bills.
- **One-offs:** big purchases are kept apart from your normal month.
- **Review list:** unsure entries and possible duplicates wait for you to confirm them.
- **Import:** a debit tracker workbook, CSV statements and backups. Files are checked before anything changes, and importing twice does not create duplicates.

## Privacy

Your data stays in your browser. Files are read on your device and nothing is uploaded. Browser data can be cleared, so export a backup from the Import page now and then.

Never commit real statements. `private-data/`, spreadsheets and backups are ignored by git, and tests use made-up transactions.

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

## Layout

- `src/core/`: money, dates, ledger rules, cycles, calculations, importers and migration. No UI, fully tested.
- `src/store.js`: saving and loading. Every page shares it.
- `src/pages/`: the screens.
