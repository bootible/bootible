---
title: Your Config Repo
description: Store your Bootible configuration in a private GitHub repo you can edit from any browser — no git skills required
---

# Your Config Repo

Your personal Bootible configuration lives in a small **private GitHub repository**. You can create it and edit it entirely from a web browser — no git commands, no terminal. Bootible handles the rest on the device.

No GitHub account? Skip to [No GitHub? Use a local config](#no-github-use-a-local-config).

---

## Why a config repo?

| Without a config repo | With a config repo |
|---------------------|-------------------|
| Default settings only | Fully customized setup |
| Logs saved locally | Run logs synced to GitHub |
| Manual config on each device | Same config across all devices |
| No version history | Full git history of changes |

---

## Set it up from your browser

### 1. Create a private repository

Go to [github.com/new](https://github.com/new):

- **Repository name**: something like `gaming`, `bootible-config`, or `dotfiles`
- **Visibility**: :material-lock: **Private**
- Check **"Add a README file"** so the repo has a first commit

That's the whole job in the browser for now. An empty repo is fine — Bootible copes happily with a config repo that has no config in it yet.

### 2. Tell Bootible about it

Run the one-liner on your device ([Try It in 5 Minutes](quick-try.md) if this is your first time). When it asks, answer `y` and enter your details:

```
Do you have a private config repo? (y/N): y
Your GitHub username: yourname
Private repo (e.g., owner/repo): yourname/gaming
```

### 3. Sign in with your phone

Bootible uses GitHub's **device flow** for authentication: a window pops up with a QR code and a short code. Scan the QR with your phone (or visit [github.com/login/device](https://github.com/login/device) anywhere), enter the code, and approve. No password is ever typed into Bootible, and nothing needs the on-screen keyboard.

### 4. Bootible clones it

Your repo is cloned to the `private/` folder inside Bootible's install directory (see [where that is](#where-your-config-lives-on-the-device)). If the repo doesn't contain a device config yet, Bootible reports `Using default configuration` and carries on with the defaults — nothing breaks.

---

## Add your device's config (in the browser)

Bootible looks for one folder per device, in this layout:

```
device/<platform>/<DeviceName>/config.yml
```

- `<platform>` is `rog-ally` or `steamdeck`
- `<DeviceName>` is any name you like — your hostname or a memorable name (letters, numbers, dashes, underscores)

To create it with the GitHub web editor:

1. In your repo, click **Add file → Create new file**.
2. In the filename box, type the full path — typing `/` creates folders as you go:
   ```
   device/rog-ally/MyAlly/config.yml
   ```
3. Paste your overrides. You only need the settings you want **different from the defaults**:

    === "ROG Ally"

        ```yaml
        # device/rog-ally/MyAlly/config.yml
        install_discord: true
        install_moonlight: true
        install_firefox: true
        sleep_mode: "hibernate"
        ```

    === "Steam Deck"

        ```yaml
        # device/steamdeck/MyDeck/config.yml
        install_discord: true
        install_moonlight: true
        install_decky: true
        ```

4. Click **Commit changes**.

Every available key is documented in [Config Basics](config-basics.md) and the per-device pages under [Configure Your Device](../configure/index.md).

### Pick up the changes on your device

The `bootible` command runs from the copy of your repo already on the device. To pull in what you just edited on GitHub, re-run the one-liner — it updates your private repo (answer `y` and enter the same `owner/repo` when asked), then shows a fresh preview. When the preview looks right:

```
bootible
```

!!! tip "Editing on the device instead"
    You can also edit the cloned file directly on the device (any text editor) and run `bootible` straight away — no re-download needed. See [where your config lives](#where-your-config-lives-on-the-device).

---

## Where your config lives on the device

=== "ROG Ally / Windows"

    ```
    %USERPROFILE%\bootible\private\device\rog-ally\<DeviceName>\config.yml
    ```

    (Usually `C:\Users\you\bootible\private\...`)

=== "Steam Deck"

    ```
    ~/bootible/private/device/steamdeck/<DeviceName>/config.yml
    ```

---

## Full repository structure

As you grow into it, your repo can hold more than config:

```
your-repo/
├── device/
│   ├── rog-ally/
│   │   └── MyAlly/                 # One folder per device
│   │       ├── config.yml          # Device configuration
│   │       ├── Images/             # Wallpapers, lockscreen images
│   │       └── Logs/               # Run logs (pushed automatically)
│   └── steamdeck/
│       └── MyDeck/
│           └── config.yml
├── scripts/                        # Shared scripts (EmuDeck EA, etc.)
└── ssh-keys/                       # SSH public keys (.pub only!)
```

| Directory | Purpose |
|-----------|---------|
| `device/<platform>/<name>/` | Per-device configuration and files |
| `scripts/` | Shared scripts across all devices |
| `ssh-keys/` | SSH public keys to authorize |

Multiple device folders? Bootible lists them at run time and asks which one to use — see [Multi-Device](multi-device.md).

### Wallpapers & images

Place images in your device's `Images/` folder and reference them in your config:

```yaml
wallpaper_path: "Images/wallpaper.jpg"
lockscreen_path: "Images/lockscreen.jpg"
```

### SSH keys

Put public keys in `ssh-keys/`, then choose which to authorize:

=== "ROG Ally"

    ```yaml
    install_ssh: true
    ssh_server_enable: true
    ssh_authorized_keys:
      - "desktop.pub"
      - "laptop.pub"
    ```

=== "Steam Deck"

    ```yaml
    install_ssh: true
    ssh_import_authorized_keys: true
    ssh_authorized_keys:
      - "desktop.pub"
      - "laptop.pub"
    ```

### EmuDeck Early Access

If you have EmuDeck Patreon access, place the scripts in `scripts/` and Bootible uses the EA versions automatically:

| Platform | File |
|----------|------|
| Steam Deck | `EmuDeck EA SteamOS.desktop.download` |
| ROG Ally | `EmuDeck EA Windows.bat` |

### Run logs

Bootible pushes a transcript of each run to your device's `Logs/` folder automatically — useful for debugging and for seeing what changed over time.

---

## Prefer the terminal?

??? note "Set it up with `init-private-repo.sh` instead"

    If you have a computer with bash and git, Bootible ships a script that builds the same structure locally:

    ```bash
    git clone https://github.com/bootible/bootible.git
    cd bootible
    ./init-private-repo.sh
    ```

    It asks for your device type and a device name, creates `private/` with the full layout, downloads the current default config as your starting template, and makes the first commit.

    Then create an **empty** private repo on [github.com/new](https://github.com/new) (no README this time — the script already made the first commit) and push:

    ```bash
    cd private
    git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
    git push -u origin main
    ```

    !!! warning "SSH key required for the `git@` URL"
        The `git@github.com:...` remote shown above requires an [SSH key registered with GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh). If you don't have one, use the HTTPS URL instead: `https://github.com/YOUR_USER/YOUR_REPO.git`.

---

## No GitHub? Use a local config

You can customize Bootible without any GitHub account. Create a config file at:

=== "ROG Ally / Windows"

    ```
    %USERPROFILE%\.config\bootible\rog-ally\config.yml
    ```

=== "Steam Deck"

    ```
    ~/.config/bootible/steamdeck/config.yml
    ```

Put your overrides in it — same keys, same format as a repo config. It's merged on top of the defaults each time you run `bootible`.

!!! warning "Windows: the local config is skipped during the very first one-liner run"
    On Windows, the initial bootstrap passes an explicit config to the setup script, which bypasses the local layer. The local config applies on every `bootible` run after that. Practical order: run the one-liner once (press ++enter++ at the repo question), then create your local config, then run `bootible`. On Steam Deck the local config applies from the first run.

What you give up without a repo: synced config across devices, automatic log push, and version history.

---

## Security notes

!!! warning "Keep it private"
    Your config repo should be **private** on GitHub. It may contain SSH key references, device names and hostnames, and your personal preferences.

!!! danger "Never commit secrets"
    Never put passwords, API tokens, or private SSH keys in your config (only `.pub` files in `ssh-keys/`). If you need GitHub access on the device, the QR sign-in handles it — no tokens to paste.
