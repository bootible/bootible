---
title: Troubleshooting
description: Common issues and how to fix them
---

# Troubleshooting

Solutions to common Bootible issues.

---

## Bootstrap Issues

### Script Download Failed

**Symptom:** `curl: (6) Could not resolve host: bootible.dev`

**Solutions:**

1. Check internet connection
2. Try a different DNS: `curl --dns-servers 1.1.1.1 ...`
3. Download manually and run locally

### Permission Denied

=== "Steam Deck"

    **Symptom:** `Permission denied` when running script

    **Solution:**
    ```bash
    chmod +x deck.sh
    ./deck.sh
    ```

=== "ROG Ally"

    **Symptom:** Script won't run in PowerShell

    **Solution:** Ensure you're running as Administrator (right-click > Run as Administrator)

### GitHub Authentication Failed

**Symptom:** QR code flow fails or times out

**Solutions:**

1. Ensure you have internet access
2. Try the code manually at `github.com/login/device`
3. Clear browser cache and try again
4. Wait a few minutes and retry (rate limiting)

---

## Steam Deck Issues

### Decky Not Showing in Quick Access Menu

**Solutions:**

1. **Restart Steam:** Hold Power > Restart Steam
2. **Reinstall Decky:** Re-run `bootible`
3. **Check install:**
   ```bash
   ls ~/homebrew/plugins/
   ```
4. **Check Decky service:**
   ```bash
   systemctl --user status plugin_loader
   ```

### Flatpak Install Failed

**Symptom:** App installation errors

**Solutions:**

1. **Update Flatpak:**
   ```bash
   flatpak update
   ```

2. **Check Flathub:**
   ```bash
   flatpak remote-list
   ```

3. **Add Flathub if missing:**
   ```bash
   flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
   ```

4. **Check app ID is correct** - search on Flathub.org

### SSH Connection Refused

**Solutions:**

1. **Check service:**
   ```bash
   systemctl status sshd
   ```

2. **Start if stopped:**
   ```bash
   sudo systemctl enable --now sshd
   ```

3. **Check firewall:**
   ```bash
   sudo firewall-cmd --list-all
   ```

4. **Verify port:**
   ```bash
   ss -tlnp | grep ssh
   ```

### Ansible Errors

**Symptom:** Playbook fails with red error text

**Common Causes:**

1. **Wrong sudo password:** Re-run and enter correct password
2. **Network timeout:** Retry - temporary network issue
3. **Package not found:** Check Flatpak app ID is correct
4. **Permission denied:** Ensure `--ask-become-pass` is used

**Debug Mode:**
```bash
ansible-playbook playbook.yml --ask-become-pass -vvv
```

### SteamOS Update Broke Things

SteamOS updates can reset:

- Decky Loader
- Pacman packages
- Some system configs

**Solution:** Re-run Bootible
```bash
bootible
```

Flatpak apps and your config survive updates.

---

## ROG Ally Issues

!!! tip "Setup reverted after a Windows Update?"
    Battery draining in sleep again, Game Bar back, settings undone — that's drift, not breakage, and the fix is one command. See [Re-running & Drift](re-running.md).

### Winget Not Working

!!! info "Bootible retries this automatically"
    When winget reports a source failure mid-run, Bootible resets and updates the sources once per run and retries before falling back to msstore. The steps below are for when that automatic recovery isn't enough.

**Solutions:**

1. **Update App Installer:**
   - Open Microsoft Store > Library > Update all
   - Search "App Installer" and update

2. **Reset sources:**
   ```powershell
   winget source reset --force
   ```

3. **Reinstall winget:**
   ```powershell
   Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe
   ```

### Package Install Failed

**Symptom:** Specific package fails to install

**Solutions:**

1. **Run dry-run to validate:**
   ```powershell
   .\Run.ps1 -DryRun
   ```

2. **Try manual install:**
   ```powershell
   winget install PackageId --accept-source-agreements
   ```

3. **Check exact package ID:**
   ```powershell
   winget search "package name"
   ```

### Registry Changes Not Applied

**Symptom:** Settings don't take effect

**Solutions:**

1. **Sign out and back in** - some HKCU changes need this
2. **Check scheduled task** - UCPD-protected keys use scheduled tasks
3. **Restart** - some changes require reboot

### SSH Not Working

**Solutions:**

1. **Check OpenSSH installed:**
   ```powershell
   Get-WindowsCapability -Online | Where-Object Name -like '*OpenSSH*'
   ```

2. **Check service:**
   ```powershell
   Get-Service sshd
   ```

3. **Start service:**
   ```powershell
   Start-Service sshd
   Set-Service sshd -StartupType Automatic
   ```

4. **Check firewall:**
   ```powershell
   Get-NetFirewallRule -DisplayName "*SSH*"
   ```

### PowerShell Script Blocked

**Symptom:** "Running scripts is disabled on this system"

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Configuration Issues

### Invalid YAML Syntax

**Symptom:** "yaml: line X: mapping values are not allowed"

**Common Causes:**

1. **Missing colon after key:**
   ```yaml
   # Wrong
   install_discord true

   # Correct
   install_discord: true
   ```

2. **Incorrect indentation:**
   ```yaml
   # Wrong (inconsistent spaces)
   static_ip:
     enabled: true
       address: "1.2.3.4"

   # Correct
   static_ip:
     enabled: true
     address: "1.2.3.4"
   ```

3. **Quotes missing around special characters:**
   ```yaml
   # Wrong
   hostname: my-deck!@#

   # Correct
   hostname: "my-deck"
   ```

### Type Validation Errors

**Symptom:** "expected bool, got string"

**Common Mistakes:**

| Wrong | Correct |
|-------|---------|
| `ssh_port: "22"` | `ssh_port: 22` |
| `install_discord: yes` | `install_discord: true` |
| `install_discord: "true"` | `install_discord: true` |

### Config Not Being Applied

**Checklist:**

1. File is in correct location?
   - `private/device/<platform>/<instance>/config.yml`

2. Device instance selected correctly?
   - Check prompt during bootstrap

3. YAML is valid?
   - Use online YAML validator

4. Values are correct type?
   - Check validation output

---

## Network Issues

### Can't Reach Device

**Checklist:**

1. Same network?
2. IP address correct?
3. Firewall allowing connections?
4. Service running on device?

**Find device IP:**

=== "Steam Deck"

    ```bash
    hostname -I
    ```

=== "ROG Ally"

    ```powershell
    ipconfig | findstr "IPv4"
    ```

### Static IP Not Working

**Solutions:**

1. **Verify network connection name** - use exact name from `nmcli con show` or `Get-NetAdapter`
2. **Check for typos** in IP address format
3. **Ensure gateway is correct** - usually your router's IP
4. **Check no IP conflict** - another device using same IP?

### Tailscale Can't Connect

**Solutions:**

1. **Re-authenticate:**
   ```bash
   tailscale down
   tailscale up
   ```

2. **Check status:**
   ```bash
   tailscale status
   ```

3. **Firewall blocking?** - Tailscale needs UDP 41641

---

## Emulation Issues

### EmuDeck Won't Run

**Solutions:**

1. **Double-click the desktop shortcut** (not the file)
2. **Check it's executable:**
   ```bash
   chmod +x ~/Desktop/EmuDeck.desktop
   ```
3. **Download fresh:**
   ```bash
   curl -fsSL https://www.emudeck.com/EmuDeck.desktop -o ~/Desktop/EmuDeck.desktop
   ```

### ROMs Not Appearing in Steam

**Checklist:**

1. ROMs in correct folder? (check `~/Emulation/roms/<system>/`)
2. Ran Steam ROM Manager?
3. Clicked "Save to Steam"?
4. Restarted Steam?

### Emulator Performance Issues

**General Tips:**

1. Lower resolution/upscaling
2. Disable enhancements
3. Check TDP isn't limited (PowerTools)
4. Use performance power profile
5. Close background apps

---

## Backup & Recovery {#backup--recovery}

### Steam Deck: Restore from Snapshot

!!! danger "This replaces your home folder's current state"
    These commands delete the live `/home` subvolume and replace it with the pre-Bootible snapshot. **Everything changed since that snapshot is lost** — game saves, downloads, configs. Back up anything you want to keep first, and only proceed if rolling back to the pre-Bootible state is genuinely your goal. If you just want to fix a broken setting, re-run `bootible` instead.

```bash
# List snapshots
sudo ls /home/.snapshots/

# Restore (requires root)
sudo btrfs subvolume delete /home
sudo btrfs subvolume snapshot /home/.snapshots/bootible-pre-setup-XXXXX /home
```

### ROG Ally: System Restore

1. Search "Create a restore point" in Start
2. Click "System Restore"
3. Select the Bootible restore point
4. Follow wizard

---

## Getting Help

If these don't solve your issue:

1. **Check logs** — Steam Deck: `~/bootible/private/device/steamdeck/<name>/Logs/` · ROG Ally: PowerShell transcript
2. **Search existing issues** — [GitHub Issues](https://github.com/bootible/bootible/issues)
3. **Open new issue** with device/OS version, config snippet (remove secrets!), full error, and steps to reproduce
