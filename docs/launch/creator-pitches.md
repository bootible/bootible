# Creator Pitches (drafts)

Two outreach drafts plus a shared demo script. For Gavin to personalize and send himself — do not send as-is, and do not invent contact addresses.

## rogallylife.com

Contact route: via the contact form at rogallylife.com.

> Hi — I'm the maintainer of Bootible (https://github.com/bootible/bootible), a free, MIT-licensed tool that automates the "new Ally checklist" your guides walk people through: one PowerShell command debloats Windows, switches sleep to hibernate, optionally installs G-Helper, installs the owner's launchers and streaming apps, and leaves a plain-English receipt on the Desktop. The part your readers will care about most: re-running it after a Windows update detects what the update reverted and repairs it — the "an update broke my setup again" pain the community keeps hitting. It's dry-run by default, and each owner's config lives in their own private GitHub repo so a fresh wipe or a second device is the same one command. I'd love to give you early access and a guided demo before I post about it more widely — happy to answer anything. Docs: https://docs.bootible.dev

## ETA PRIME

Contact route: business email listed on the YouTube about page.

> Hi — I built Bootible (https://github.com/bootible/bootible), a free, open-source tool that takes a fresh ROG Ally from out-of-the-box to fully set up in one cut: a single PowerShell command debloats Windows, fixes the sleep-drains-battery problem by switching to hibernate, optionally installs G-Helper, installs the user's chosen launchers and streaming clients, and drops a receipt on the Desktop listing everything it did. It demos really well on camera — dry-run preview first, then one word (`bootible`) and the machine sets itself up while you talk, and re-running it after a Windows update visibly repairs what the update broke. If you'd find it useful for an Ally setup video I'd love to give you early access and a walkthrough. Docs: https://docs.bootible.dev

## Shared demo script — the 60-second flow

Fresh Ally desktop to fully set up, then "an update broke it" to repaired, in one continuous take.

1. **Open on a fresh Ally desktop** — stock Windows, nothing installed. (Optional voiceover: "everyone's first hour with this thing.")
2. **Open PowerShell as Administrator.**
3. **Type the one-liner:** `irm https://bootible.dev/rog | iex`
4. **Let the dry-run scroll.** Nothing is being changed yet — call that out. Pause on the **Smart App Control warning** (the thing that silently breaks Armoury Crate if you don't deal with it early).
5. **Type `bootible`** — the real run starts.
6. **Cut between apps installing** — winget pulling Steam, Moonlight, G-Helper, etc.
7. **Show the Desktop receipt** — open "Bootible - Read Me.md": apps installed, changes applied, FAQ.
8. **Simulate "Windows Update broke it"** — manually revert a setting Bootible manages (e.g. flip a debloat registry value or re-enable sleep) off-camera or in a quick cut.
9. **Re-run `bootible`** — pause on the "DRIFT DETECTED SINCE LAST RUN" report (what differs from the known-good snapshot taken on the first run), then point at the "Repaired drift" lines in the receipt: it found what reverted and fixed it, and it only says "repaired" because it verified the fix after applying.
10. **Close on the one-two punch:** one command on day one, the same command after every update.
