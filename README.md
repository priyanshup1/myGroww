# myGroww

A private personal finance app for salaried people in India who support family and invest monthly. It answers one question first: how much is safe to spend?

## What it does

- **Connected cards:** your salary, family, bills, SIPs, goals and safety net are joined on one screen, and money visibly moves between them when something changes.
- **Safe to spend:** your salary, minus what has gone out, what is planned for family, SIPs, bills and goals, and what is unpaid on your card.
- **Quick add:** log an expense in seconds, with your most-used categories first.
- **Goals planner:** how much to save, how long it takes, and whether your goals compete for the same money.
- **Future projection:** your investments 1, 2 or 5 years out, at a return rate you choose.
- **Bills and budgets:** repeating bills, yearly ones saved for monthly, and limits only where you want them.
- **Cycle review:** a finished salary cycle in a few plain sentences.
- **Two themes:** Obsidian Gold and Midnight Emerald, each in dark and light.
- **Installable:** add it to your phone and use it without internet.

Under the surface, every number comes from one list of transactions, so screens cannot disagree. Card purchases count as spending when you buy. Card bills, SIPs, savings and transfers never do.

## Privacy

Your data stays in your browser. Files are read on your device and nothing is uploaded. Browser data can be cleared and does not move between devices, so export a backup from Settings now and then.

`public/vault.json` is the one exception: it is encrypted, and opens only with a long random passphrase kept outside git. It is public and stays in git history, so its safety depends entirely on that passphrase staying private.

Never commit real statements. `private-data/`, spreadsheets and backups are ignored by git, and tests use made-up transactions.

## Reminders

There is no server, so the app cannot alert you while it is closed. Download the calendar file from Plan, then Bills, and your phone's calendar will remind you instead.

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

Offline use and installing only work in a production build:

```bash
npm run build
```

```bash
npm run preview
```

## Layout

- `src/core/`: money, dates, ledger rules, cycles, goals, bills, calculations, importers and migration. No UI, fully tested.
- `src/store.js`: saving and loading. Every page shares it.
- `src/prefs.js`: theme and other per-device settings.
- `src/components/`: the money map, quick-add sheet, charts and shared parts.
- `src/pages/`: Home, Activity, Plan, Wealth, Review, Cycle review, Settings and first-run setup.
- `PRODUCT.md` and `DESIGN.md`: what the product is and how it should look.
