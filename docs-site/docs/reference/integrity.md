---
title: Release Channels & Integrity
description: How Bootible's Cloudflare worker pins releases, serves integrity headers, and why irm | iex is trustworthy here
---

# Release Channels & Integrity

<!-- Built in docs plan Task 5 -->

This page will explain the trust model: why `irm | iex` is different here (worker serves deploy-time-pinned `STABLE_REF` + per-channel sha256), the verification headers (`X-Bootible-Ref` / `X-Bootible-Integrity`) with a check-it-yourself snippet, the GitHub-raw fallback caveat (verification bypassed with console warning), and what a release activation looks like. Sources: `cloudflare/_worker.js` and `docs/releasing.md`.
