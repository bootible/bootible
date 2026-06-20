import { describe, expect, it } from "vitest";
import {
  type AutounattendConfig,
  generateAutounattend,
  generateWifiProfileXml,
} from "./autounattend";

const base: AutounattendConfig = {
  account: { mode: "local", username: "gavin", password: "hunter2" },
  firstLogonCommand: "powershell.exe -ExecutionPolicy Bypass -File C:\\bootible\\bootstrap.ps1",
};

describe("generateAutounattend", () => {
  it("produces an unattend document with the windowsPE/specialize/oobeSystem passes", () => {
    const xml = generateAutounattend(base);
    expect(xml).toContain('<unattend xmlns="urn:schemas-microsoft-com:unattend">');
    expect(xml).toContain('pass="windowsPE"');
    expect(xml).toContain('pass="specialize"');
    expect(xml).toContain('pass="oobeSystem"');
  });

  it("wipes disk 0 and installs the chosen edition", () => {
    const xml = generateAutounattend({ ...base, edition: "Windows 11 Pro" });
    expect(xml).toContain("<WillWipeDisk>true</WillWipeDisk>");
    expect(xml).toContain("<Value>Windows 11 Pro</Value>");
    expect(xml).toContain("<AcceptEula>true</AcceptEula>");
  });

  it("defaults the edition to Windows 11 Home", () => {
    expect(generateAutounattend(base)).toContain("<Value>Windows 11 Home</Value>");
  });

  it("creates an auto-logon local admin and hides the online account screen in local mode", () => {
    const xml = generateAutounattend(base);
    expect(xml).toContain("<LocalAccounts>");
    expect(xml).toContain("<Name>gavin</Name>");
    expect(xml).toContain("<Group>Administrators</Group>");
    expect(xml).toContain("hunter2");
    expect(xml).toContain("<AutoLogon>");
    expect(xml).toContain("<HideOnlineAccountScreens>true</HideOnlineAccountScreens>");
  });

  it("omits the local account and auto-logon in microsoft (semi-attended) mode", () => {
    const xml = generateAutounattend({ ...base, account: { mode: "microsoft" } });
    expect(xml).not.toContain("<LocalAccounts>");
    expect(xml).not.toContain("<AutoLogon>");
    expect(xml).toContain("<HideOnlineAccountScreens>false</HideOnlineAccountScreens>");
  });

  it("runs the bootible bootstrap as the first logon command", () => {
    const xml = generateAutounattend(base);
    expect(xml).toContain("<FirstLogonCommands>");
    expect(xml).toContain("C:\\bootible\\bootstrap.ps1");
  });

  it("pre-seeds wifi and hides the wireless OOBE step when wifi is given", () => {
    const xml = generateAutounattend({ ...base, wifi: { ssid: "NerdzNet", password: "pw" } });
    expect(xml).toContain("netsh wlan add profile");
    expect(xml).toContain("<HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>");
  });

  it("does not emit a wifi command when no wifi is given", () => {
    expect(generateAutounattend(base)).not.toContain("netsh wlan add profile");
  });

  it("sets the computer name when provided", () => {
    expect(generateAutounattend({ ...base, computerName: "ALLY-X" })).toContain(
      "<ComputerName>ALLY-X</ComputerName>",
    );
  });

  it("escapes xml-special characters in user values", () => {
    const xml = generateAutounattend({ ...base, account: { mode: "local", username: "a&b" } });
    expect(xml).toContain("a&amp;b");
    expect(xml).not.toContain("<Name>a&b</Name>");
  });
});

describe("generateWifiProfileXml", () => {
  it("builds a WPA2-PSK profile carrying the ssid and passphrase", () => {
    const xml = generateWifiProfileXml("NerdzNet", "s3cret");
    expect(xml).toContain("<WLANProfile");
    expect(xml).toContain("<name>NerdzNet</name>");
    expect(xml).toContain("<authentication>WPA2PSK</authentication>");
    expect(xml).toContain("<keyMaterial>s3cret</keyMaterial>");
  });

  it("escapes special characters in the ssid and key", () => {
    const xml = generateWifiProfileXml("Net&Co", "a<b");
    expect(xml).toContain("Net&amp;Co");
    expect(xml).toContain("a&lt;b");
  });
});
