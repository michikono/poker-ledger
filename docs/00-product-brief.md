# 00 — Product Brief

> Status: Draft — fill this before Phase 1 begins.

## One-sentence description

This is an app for friends to keep track of their poker cash game balances with each other. 
## Problem statement

The main problem is that when people are doing a cash game, people kind of sit down and buy in for different amounts at different times, and then people leave at different times in the night. Sometimes it's difficult to figure out who owes what at the end of the night and settle everything up. Also, it's kind of annoying to figure out, since different people might have to band together to pay out a big winner. It's annoying to track exactly how many transactions you have to make to figure out what it takes to get everyone to the net zero based on what they've earned or lost. You want an app that makes that easy. 

## Target users

Casual poker players that are doing cash games in a small group setting.

## Core value proposition

This app will make it easy to initialize a cash game, share the link with your colleagues, have them track their buy-in and cash out, and then help everybody settle up at the end of the night.

> **Auth note:** Recipients of a shared link must sign in with Google before viewing — this is a deliberate trade-off documented in ADR `0003-auth-model.md`. Players being tracked by the app (e.g., "Billy") do NOT need a Google account; only signed-in users recording the data do.

## Non-goals (product level)

This is not a product to learn how to play poker, or to track other types of games that are not poker, or to track multiple different types of currencies, or to do currency conversions. Nor should it facilitate the actual movement of money, since that is something that people can track themselves.

## Constraints and assumptions

This app will not push out any notification-type activity and is strictly a simple read/write operation application

## Open questions

All resolved in design phase — see `docs/11-open-questions.md` for the audit trail.

## Related docs

- `12-mvp-scope.md` — what is in scope for the first version
- `11-open-questions.md` — unresolved issues
