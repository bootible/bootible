// Non-essential services set to manual ("demand") start — ported from the v1
// set_services_manual list (config/rog-ally/modules/debloat.ps1). Trimming
// these frees background resources for games without removing functionality.
const TRIM_SERVICES = [
  "DiagTrack", // Connected User Experiences and Telemetry
  "dmwappushservice", // WAP Push Message Routing Service
  "MapsBroker", // Downloaded Maps Manager
  "SharedAccess", // Internet Connection Sharing
  "RemoteRegistry", // Remote Registry
  "WMPNetworkSvc", // Windows Media Player Network Sharing
];

/**
 * Build `sc config <svc> start= demand` command arrays that set non-essential
 * services to manual start. The executor's runner decides whether they run.
 */
export function getServiceTrimCommands(): string[][] {
  return TRIM_SERVICES.map((service) => ["sc", "config", service, "start=", "demand"]);
}
