---
title: How Drift Detection Works
description: The contract page for Bootible's drift detection — what is probed, where state lives, and how repairs are verified
---

# How Drift Detection Works

<!-- Built in docs plan Task 5 -->

This page will contain the drift detection contract: the exact list of monitored surfaces (from `Get-LiveState`), where `state.json` lives, the local-only-by-design rationale, baselining semantics (detector not compliance engine), `-Tags`/no-instance exclusions, GPU report-only behavior, and the verified-repair flow (`Get-VerifiedRepairs`). Sources: `lib/state-snapshot.ps1` and the drift blocks in `Run.ps1`.
