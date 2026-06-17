# Bootible Architecture

System diagrams for understanding bootible's bootstrap, configuration, and module flows.

## Bootstrap Flow

How bootible initializes on each platform.

### Windows (ROG Ally)

```mermaid
flowchart TD
    A[irm bootible.dev/rog] --> B{BOOTIBLE_DIRECT?}
    B -->|No| C[Download & re-run]
    B -->|Yes| D[Detect Device]
    C --> D
    D --> E[Install Git/GitHub CLI]
    E --> F[Clone Bootible]
    F --> G[Merge Configs]
    G --> H[Run Modules]
```

### Linux (Steam Deck)

```mermaid
flowchart TD
    A[curl bootible.dev/deck] --> B[Detect Device]
    B --> C[Check sudo]
    C --> D[Create Snapshot]
    D --> E[Install Ansible]
    E --> F[Clone Bootible]
    F --> G[Merge Configs]
    G --> H[Run Playbook]
```

## Config Merge Flow

Configuration loading follows a layered override pattern.

```mermaid
flowchart LR
    A[config.yml<br/>defaults] --> B[Merge]
    C[~/.config/bootible<br/>local] --> B
    D[private/device<br/>overrides] --> B
    B --> E[Final Config]
```

**Priority** (highest wins): Private > Local > Defaults

- **Defaults**: `config/<device>/config.yml` - ships with bootible
- **Local**: `~/.config/bootible/<device>/config.yml` - machine-specific
- **Private**: `private/<device>/config.yml` - synced via git

## Module Dependencies

Modules execute in a specific order to ensure dependencies are met.

### Windows Modules

```mermaid
flowchart LR
    A[validate] --> B[base]
    B --> C[apps]
    C --> D[gaming]
    D --> E[streaming]
    E --> F[remote_access]
    F --> G[ssh]
    G --> H[emulation]
    H --> I[rog_ally]
    I --> J[optimization]
    J --> K[debloat]
```

### Steam Deck Roles

```mermaid
flowchart LR
    A[base] --> B[flatpak_apps]
    B --> C[ssh]
    C --> D[tailscale]
    D --> E[remote_desktop]
    E --> F[decky]
    F --> G[proton]
    G --> H[emulation]
    H --> I[stickdeck]
    I --> J[waydroid]
    J --> K[distrobox]
```

## Device Detection Logic

How bootible identifies the target device.

### Windows Detection

```mermaid
flowchart TD
    A[Read WMI] --> B{ASUS ROG Ally?}
    B -->|Yes| C[rog-ally]
    B -->|No| D{Legion Go?}
    D -->|Yes| C
    D -->|No| E{MSI Claw?}
    E -->|Yes| C
    E -->|No| F[Default: rog-ally]
```

### Linux Detection

```mermaid
flowchart TD
    A[Check /etc/os-release] --> B{SteamOS?}
    B -->|Yes| C[steamdeck]
    B -->|No| D{Arch-based?}
    D -->|Yes| C
    D -->|No| E{ROG Ally DMI?}
    E -->|Yes| C
    E -->|No| F[Default: steamdeck]
```
