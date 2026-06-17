# Troubleshooting Guide

This guide covers common issues when running Bootible on ROG Ally (Windows) and Steam Deck (SteamOS).

---

## ROG Ally (Windows)

### winget source errors

**Symptom**: "Failed to update source" or certificate validation errors during package installation.

**Solution**:
1. Ensure you're running PowerShell as Administrator
2. Sync system time (certificates require accurate time):
   ```powershell
   w32tm /resync /force
   ```
3. Reset winget sources:
   ```powershell
   winget source reset --force
   winget source update
   ```
4. If msstore source is missing, add it:
   ```powershell
   winget source add msstore https://storeedgefd.dsx.mp.microsoft.com/v9.0
   ```

### GitHub authentication fails

**Symptom**: Device flow times out, QR code doesn't appear, or credential prompt hangs indefinitely.

**Solution**:
1. Close all PowerShell windows and retry
2. If the QR popup doesn't appear, manually visit: https://github.com/login/device
3. Enter the code displayed in the terminal
4. If using a corporate network, check if github.com is blocked
5. For persistent issues, pre-authenticate with GitHub CLI:
   ```powershell
   winget install GitHub.cli
   gh auth login
   ```

### Package installation failures

**Symptom**: Packages fail to install with exit code errors or timeouts.

**Solution**:
1. Check if the package already exists (may be installed under different ID):
   ```powershell
   winget list | Select-String "PackageName"
   ```
2. Try installing from alternate source:
   ```powershell
   winget install PackageId --source msstore
   ```
3. For timeout issues (large packages), increase timeout or install manually:
   ```powershell
   winget install PackageId --wait
   ```
4. Clear winget cache:
   ```powershell
   Remove-Item "$env:LOCALAPPDATA\Packages\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe\LocalState\*" -Force -Recurse
   ```

### Git installation not found after install

**Symptom**: Git installs successfully but `git` command not found.

**Solution**:
1. Refresh PATH in current session:
   ```powershell
   $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
   ```
2. Or close and reopen PowerShell (as Administrator)
3. If still not found, add Git to PATH manually:
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\Git\cmd", "User")
   ```

### PowerShell execution policy blocks script

**Symptom**: Script fails with "running scripts is disabled on this system" error.

**Solution**:
1. Run with bypass for current session:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
2. Or set persistent policy (as Administrator):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

### Private repo clone fails with credential errors

**Symptom**: "Authentication failed" when cloning private repository.

**Solution**:
1. Verify GitHub authentication status:
   ```powershell
   gh auth status
   ```
2. Setup git to use GitHub CLI for credentials:
   ```powershell
   gh auth setup-git
   ```
3. If using SSH, check key is registered:
   ```powershell
   ssh -T git@github.com
   ```

### YAML module installation fails offline

**Symptom**: "Cannot reach PowerShell Gallery" error when installing powershell-yaml.

**Solution**:
1. Pre-install the module while online:
   ```powershell
   Install-Module -Name powershell-yaml -Scope CurrentUser
   ```
2. For fully offline installs, on another machine:
   ```powershell
   Save-Module -Name powershell-yaml -Path C:\Modules
   ```
   Then copy to target machine and:
   ```powershell
   Copy-Item C:\Modules\powershell-yaml $env:USERPROFILE\Documents\PowerShell\Modules\ -Recurse
   ```

---

## Steam Deck (SteamOS)

### Read-only filesystem errors

**Symptom**: "Read-only file system" when installing packages via pacman.

**Solution**:
1. Temporarily disable read-only mode:
   ```bash
   sudo steamos-readonly disable
   ```
2. After installing, re-enable:
   ```bash
   sudo steamos-readonly enable
   ```
3. Note: SteamOS updates may reset pacman-installed packages. Prefer pip or Flatpak where possible.

### No sudo password set

**Symptom**: Bootstrap fails with "No sudo password set" message.

**Solution**:
1. Set a password for your user:
   ```bash
   passwd
   ```
2. Re-run the bootstrap script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/bootible/bootible/main/targets/deck.sh | bash
   ```

### Ansible installation fails

**Symptom**: Ansible fails to install via pip or pacman.

**Solution**:
1. Prefer pip installation (survives SteamOS updates):
   ```bash
   pip3 install --user ansible
   export PATH="$HOME/.local/bin:$PATH"
   ```
2. Add to PATH permanently:
   ```bash
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```
3. If pip fails, refresh pacman keyring:
   ```bash
   sudo steamos-readonly disable
   sudo pacman-key --init
   sudo pacman-key --populate archlinux
   sudo pacman -Sy archlinux-keyring
   sudo pacman -S ansible
   sudo steamos-readonly enable
   ```

### Decky plugin installation fails with rate limit

**Symptom**: Plugins fail to install with 403 errors or "rate limit exceeded" messages.

**Solution**:
1. Create a GitHub personal access token at: https://github.com/settings/tokens
2. Add token to your config.yml:
   ```yaml
   github_token: "ghp_your_token_here"
   ```
3. Or set environment variable before running:
   ```bash
   export GITHUB_TOKEN="ghp_your_token_here"
   ansible-playbook playbook.yml --ask-become-pass
   ```
4. Without a token, you may see a warning about installing multiple plugins

### Btrfs snapshot creation fails

**Symptom**: "Could not create snapshot" warning during setup.

**Solution**:
1. This is non-fatal - setup will continue without snapshot
2. To create snapshots manually:
   ```bash
   sudo btrfs subvolume snapshot /home /home/.snapshots/manual-backup
   ```
3. If `/home` is not on btrfs, snapshots are not supported

### Flatpak installation fails

**Symptom**: Flatpak apps fail to install or update.

**Solution**:
1. Ensure Flathub is configured:
   ```bash
   flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
   ```
2. Clear Flatpak cache:
   ```bash
   flatpak repair --user
   ```
3. Update Flatpak metadata:
   ```bash
   flatpak update --appstream
   ```

### SSH connection refused after setup

**Symptom**: Cannot SSH to Steam Deck after enabling SSH.

**Solution**:
1. Verify SSH service is running:
   ```bash
   sudo systemctl status sshd
   ```
2. Start and enable if needed:
   ```bash
   sudo systemctl enable --now sshd
   ```
3. Check firewall rules:
   ```bash
   sudo iptables -L -n | grep 22
   ```
4. Verify IP address:
   ```bash
   ip addr show | grep inet
   ```

### SD card not detected for emulation

**Symptom**: "SD card required but not present" error when storage_location is set to sdcard.

**Solution**:
1. Insert and mount SD card, verify it's accessible:
   ```bash
   ls /run/media/deck/
   ```
2. Or change storage_location in config.yml:
   ```yaml
   emulation:
     storage_location: internal  # or 'auto'
   ```
3. Format SD card as ext4 if not already (Gaming Mode > Settings > System > Format SD Card)

---

## General Issues

### How to re-run after failure

**ROG Ally (Windows)**:
```powershell
# From anywhere:
bootible

# Or from bootible directory:
cd $env:USERPROFILE\bootible
.\config\rog-ally\Run.ps1

# With dry run to preview:
.\config\rog-ally\Run.ps1 -DryRun
```

**Steam Deck (SteamOS)**:
```bash
# Update and re-run:
cd ~/bootible
git pull
cd config/steamdeck
ansible-playbook playbook.yml --ask-become-pass

# Dry run to preview:
ansible-playbook playbook.yml --ask-become-pass --check
```

### Debug mode

**ROG Ally (Windows)**:
```powershell
# Preview changes without applying:
.\Run.ps1 -DryRun

# Run specific modules only:
.\Run.ps1 -Tags base,apps
```

**Steam Deck (SteamOS)**:
```bash
# Verbose output:
ansible-playbook playbook.yml -v --ask-become-pass

# Very verbose:
ansible-playbook playbook.yml -vvv --ask-become-pass

# Check mode (dry run):
ansible-playbook playbook.yml --check --ask-become-pass

# Run specific tags:
ansible-playbook playbook.yml --tags "base,decky" --ask-become-pass
```

### Log locations

**ROG Ally (Windows)**:
- With private repo: `~/bootible/private/device/rog-ally/<YourDevice>/Logs/`
- Without private repo: `%TEMP%/bootible_*.log`

**Steam Deck (SteamOS)**:
- With private repo: `~/bootible/private/device/steamdeck/<YourDevice>/Logs/`
- Without private repo: `/tmp/bootible_*.log`

### Restoring from backup

**ROG Ally (Windows)**:
1. Open System Restore: Win+R, type `rstrui`
2. Select the "Bootible Pre-Setup" restore point
3. Follow prompts to restore

**Steam Deck (SteamOS)**:
```bash
# List available snapshots:
sudo ls -la /home/.snapshots/

# Restore a snapshot (requires reboot):
sudo btrfs subvolume set-default /home/.snapshots/bootible-pre-setup-YYYYMMDD-HHMMSS
sudo reboot
```

---

## FAQ

### Can I run bootible multiple times?

Yes. Bootible is idempotent - running it again will:
- Skip packages already installed
- Update existing configurations
- Not duplicate settings

### How do I update my configuration?

1. Edit your private config file:
   - Windows: `bootible/private/device/rog-ally/<YourDevice>/config.yml`
   - Steam Deck: `bootible/private/device/steamdeck/<YourDevice>/config.yml`
2. Re-run bootible to apply changes

### How do I add new packages?

Add packages to your config.yml under the appropriate section:
```yaml
# Windows (rog-ally)
apps:
  winget:
    - id: "Publisher.PackageName"
      name: "Display Name"

# Steam Deck
flatpak_apps:
  - com.example.AppId
```

### Where are my installed games/ROMs?

**Steam Deck**:
- Internal: `~/Emulation/` or `~/.local/share/`
- SD Card: `/run/media/deck/<sdcard>/Emulation/`

**ROG Ally**:
- Check your config.yml for configured paths
- Default varies by emulator

### How do I completely reset bootible?

**ROG Ally (Windows)**:
```powershell
Remove-Item -Recurse -Force $env:USERPROFILE\bootible
```

**Steam Deck (SteamOS)**:
```bash
rm -rf ~/bootible
```

Then re-run the bootstrap command from the README.
