# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
One person: Eve, the owner, managing her own money in the Philippines (₱). She uses it on her iPhone as a home-screen PWA. Two scenes: payday rituals around the salary cutoffs (13th, 25th, 29th), where she ticks paid lines and checks what's left, and quick expense adds during the day. No other viewers confirmed.

## Product Purpose
A personal, cutoff-based budget and debt-payoff tool. Each month is split into two cutoffs (cutoff 1, cutoff 2); every planned line (bills, card payments, installments, savings transfers) belongs to one, and the plan is built so each cutoff nets to ₱0. Success: Eve always knows where her money went, what's paid, and that the payoff plan toward debt-free and her savings goals (₱100k, then ₱1M) is on track.

**The first question the app must answer on open (confirmed 2026-11-18): "Where did money go?"**: spending so far against budget.

## Positioning
Built around Philippine salary cutoffs and credit-card statement cycles rather than calendar months: lines per cutoff, card cycles with statement/due days, 0% and add-on installments, BNPL, e-wallet and bank "channels" (Maya, MariBank, RCBC, EastWest, Wise, CIMB...). A generic budgeting app does not model this.

## Operating Context
- Paydays: Crunchy ~13th and ~29th, PHP ~25th. Card statements arrive mid-month; due dates ~1st–9th.
- Ticking a line PAID logs the matching debt payment. Quick Add records expenses (cash, envelope/"Budget" lines, savings-funded, or card-paid). Screenshot import OCRs bank screenshots.
- Planning and bulk edits are often done by Claude through scripts against Firestore; the app must faithfully show that data.

## Capabilities and Constraints
- Tabs today: This Month (cutoff sections, lines, incomes), Debts (cards, installments, cycles, payoff plan), Add (Quick Add, import), Stats (dashboard, category bars, calendar, search), Settings (template, backups, CSV export, accounts).
- Stack: React 18 + Vite + Tailwind v4, Firebase (Firestore + Auth via 6-digit PIN), PWA deployed to cha-ching-c3470.web.app via GitHub Actions on push to main.
- Money semantics (cutoffs, envelopes/budget groups, skipped/overridden lines, savings ledger, card cycles) are load-bearing and must not change in a redesign.
- Tab structure, channel logos and dark mode are not binding commitments (not selected as must-keep on 2026-11-18); changes still need Eve's sign-off via mockups.

## Brand Commitments
- Name: **Cha-Ching**. Must stay.

## Evidence on Hand
Real data lives in Firestore; backups in `../finances/cha-ching-backups/`. Channel logos in `public/logos/`. No marketing copy, testimonials or other users exist; never fabricate them.

## Product Principles
1. Spending truth first: the opening view answers "where did my money go?" before anything else.
2. Every peso shown is exact and traceable; no rounded or decorative numbers that could mislead a payment decision.
3. Scannable under stress: Eve often opens this when money is tight; calm, clear hierarchy beats density.
4. Payday rituals are fast: ticking, checking what's left and adding an expense take seconds, one-handed.
5. Never change money behaviour to serve the look.

## Accessibility & Inclusion
Phone-first, one-handed use; large tap targets; readable figures in bright daylight.
