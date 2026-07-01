// Generates a Windows Setup answer file (autounattend.xml) for a hands-off
// install on the ROG Ally. Verified against the zero-touch research:
//  - <LocalAccounts> still works on 24H2/25H2 (programmatic unattend is
//    supported; only interactive bypasses were removed).
//  - A Microsoft account CANNOT be pre-seeded (interactive OAuth) — in that
//    mode we automate everything around the account screen and let OOBE pause
//    for that one sign-in (semi-attended).
//  - WiFi is pre-seeded with a netsh profile so first-logon commands have a
//    network (the Ally X MT7922 driver is staged separately on the USB).
//
// NOTE: structural correctness is unit-tested here; a real unattended install
// can only be proven by booting an actual Ally from the built USB.

export interface LocalAccountMode {
  mode: "local";
  username: string;
  /** Stored in plaintext in the answer file (hence client-side generation). */
  password?: string;
}

export interface MicrosoftAccountMode {
  mode: "microsoft";
}

export type AccountMode = LocalAccountMode | MicrosoftAccountMode;

export interface AutounattendConfig {
  /** Computer name; omitted → Windows assigns a random name. */
  computerName?: string;
  /** Windows image name to install. Default "Windows 11 Home". */
  edition?: string;
  /** BCP-47 locale for input/system/user locale (region + keyboard). Default "en-NZ". */
  locale?: string;
  /**
   * Windows display language — MUST match the UI language of the ISO being
   * installed, or Setup can't apply it and falls back to prompting for
   * language/keyboard. bootible downloads the "English International" image
   * (prepare-usb.ps1 $IsoLang), whose UI language is en-GB. Default "en-GB".
   */
  uiLanguage?: string;
  /** OOBE time zone. Default "New Zealand Standard Time". */
  timeZone?: string;
  account: AccountMode;
  /** Optional WiFi to pre-seed so first-logon has a network. */
  wifi?: { ssid: string; password: string };
  /** Command run once at first logon — the bootible bootstrap. */
  firstLogonCommand: string;
}

const COMPONENT_ATTRS =
  'processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" ' +
  'versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

const WIFI_PROFILE_PATH = "C:\\Windows\\Setup\\Files\\wifi.xml";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function passwordBlock(password: string): string {
  return `<Password><Value>${xmlEscape(password)}</Value><PlainText>true</PlainText></Password>`;
}

function localAccountBlock(account: LocalAccountMode): string {
  const name = xmlEscape(account.username);
  const password = account.password ?? "";
  return `
      <UserAccounts>
        <LocalAccounts>
          <LocalAccount wcm:action="add">
            <Name>${name}</Name>
            <DisplayName>${name}</DisplayName>
            <Group>Administrators</Group>
            ${passwordBlock(password)}
          </LocalAccount>
        </LocalAccounts>
      </UserAccounts>
      <AutoLogon>
        <Enabled>true</Enabled>
        <Username>${name}</Username>
        <LogonCount>1</LogonCount>
        ${passwordBlock(password)}
      </AutoLogon>`;
}

function windowsPePass(locale: string, edition: string, uiLanguage: string): string {
  return `  <settings pass="windowsPE">
    <component name="Microsoft-Windows-International-Core-WinPE" ${COMPONENT_ATTRS}>
      <SetupUILanguage><UILanguage>${uiLanguage}</UILanguage></SetupUILanguage>
      <InputLocale>${locale}</InputLocale>
      <SystemLocale>${locale}</SystemLocale>
      <UILanguage>${uiLanguage}</UILanguage>
      <UserLocale>${locale}</UserLocale>
    </component>
    <component name="Microsoft-Windows-Setup" ${COMPONENT_ATTRS}>
      <DiskConfiguration>
        <Disk wcm:action="add">
          <DiskID>0</DiskID>
          <WillWipeDisk>true</WillWipeDisk>
          <CreatePartitions>
            <CreatePartition wcm:action="add"><Order>1</Order><Type>EFI</Type><Size>300</Size></CreatePartition>
            <CreatePartition wcm:action="add"><Order>2</Order><Type>MSR</Type><Size>16</Size></CreatePartition>
            <CreatePartition wcm:action="add"><Order>3</Order><Type>Primary</Type><Extend>true</Extend></CreatePartition>
          </CreatePartitions>
          <ModifyPartitions>
            <ModifyPartition wcm:action="add"><Order>1</Order><PartitionID>1</PartitionID><Format>FAT32</Format><Label>System</Label></ModifyPartition>
            <ModifyPartition wcm:action="add"><Order>2</Order><PartitionID>2</PartitionID></ModifyPartition>
            <ModifyPartition wcm:action="add"><Order>3</Order><PartitionID>3</PartitionID><Format>NTFS</Format><Label>Windows</Label><Letter>C</Letter></ModifyPartition>
          </ModifyPartitions>
        </Disk>
      </DiskConfiguration>
      <ImageInstall>
        <OSImage>
          <InstallTo><DiskID>0</DiskID><PartitionID>3</PartitionID></InstallTo>
          <InstallFrom>
            <MetaData wcm:action="add"><Key>/IMAGE/NAME</Key><Value>${xmlEscape(edition)}</Value></MetaData>
          </InstallFrom>
        </OSImage>
      </ImageInstall>
      <UserData>
        <ProductKey><Key></Key></ProductKey>
        <AcceptEula>true</AcceptEula>
      </UserData>
    </component>
  </settings>`;
}

function specializePass(config: AutounattendConfig): string {
  const computerName = config.computerName
    ? `<ComputerName>${xmlEscape(config.computerName)}</ComputerName>`
    : "";
  const wifi = config.wifi
    ? `
    <component name="Microsoft-Windows-Deployment" ${COMPONENT_ATTRS}>
      <RunSynchronous>
        <RunSynchronousCommand wcm:action="add">
          <Order>1</Order>
          <Path>netsh wlan add profile filename="${WIFI_PROFILE_PATH}" user=all</Path>
          <Description>Pre-seed WiFi profile</Description>
        </RunSynchronousCommand>
      </RunSynchronous>
    </component>`
    : "";
  return `  <settings pass="specialize">
    <component name="Microsoft-Windows-Shell-Setup" ${COMPONENT_ATTRS}>
      ${computerName}
    </component>${wifi}
  </settings>`;
}

function oobeSystemPass(config: AutounattendConfig): string {
  const isLocal = config.account.mode === "local";
  // Escaped like every other interpolated value — catalog-sourced today, but a
  // profile/cloud-synced config could carry anything, and a stray < or & would
  // otherwise produce invalid XML that fails Setup silently.
  const locale = xmlEscape(config.locale ?? "en-NZ");
  const uiLanguage = xmlEscape(config.uiLanguage ?? "en-GB");
  const accountBlock = isLocal ? localAccountBlock(config.account as LocalAccountMode) : "";
  return `  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-International-Core" ${COMPONENT_ATTRS}>
      <InputLocale>${locale}</InputLocale>
      <SystemLocale>${locale}</SystemLocale>
      <UILanguage>${uiLanguage}</UILanguage>
      <UserLocale>${locale}</UserLocale>
    </component>
    <component name="Microsoft-Windows-Shell-Setup" ${COMPONENT_ATTRS}>
      <OOBE>
        <HideEULAPage>true</HideEULAPage>
        <HideOEMRegistrationScreen>true</HideOEMRegistrationScreen>
        <HideOnlineAccountScreens>${isLocal ? "true" : "false"}</HideOnlineAccountScreens>
        <HideWirelessSetupInOOBE>${config.wifi ? "true" : "false"}</HideWirelessSetupInOOBE>
        ${
          isLocal
            ? `<SkipMachineOOBE>true</SkipMachineOOBE>
        <SkipUserOOBE>true</SkipUserOOBE>`
            : ""
        }
        <ProtectYourPC>3</ProtectYourPC>
      </OOBE>${accountBlock}
      <TimeZone>${xmlEscape(config.timeZone ?? "New Zealand Standard Time")}</TimeZone>
      <FirstLogonCommands>
        <SynchronousCommand wcm:action="add">
          <Order>1</Order>
          <CommandLine>${xmlEscape(config.firstLogonCommand)}</CommandLine>
          <Description>bootible bootstrap</Description>
        </SynchronousCommand>
      </FirstLogonCommands>
    </component>
  </settings>`;
}

/** Build the full autounattend.xml for a hands-off Ally install. */
export function generateAutounattend(config: AutounattendConfig): string {
  // xmlEscape here so windowsPePass (which interpolates these raw) can't emit
  // invalid XML; edition is escaped inside windowsPePass, so leave it plain.
  const locale = xmlEscape(config.locale ?? "en-NZ");
  const edition = config.edition ?? "Windows 11 Home";
  const uiLanguage = xmlEscape(config.uiLanguage ?? "en-GB");
  return `<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend">
${windowsPePass(locale, edition, uiLanguage)}
${specializePass(config)}
${oobeSystemPass(config)}
</unattend>
`;
}

/** Build a WPA2-PSK WLAN profile XML to stage on the USB for pre-seeding. */
export function generateWifiProfileXml(ssid: string, password: string): string {
  const name = xmlEscape(ssid);
  return `<?xml version="1.0" encoding="utf-8"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${name}</name>
  <SSIDConfig><SSID><name>${name}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${xmlEscape(password)}</keyMaterial>
      </sharedKey>
    </security>
  </MSM>
</WLANProfile>
`;
}
