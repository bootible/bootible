import type { DeviceEntry, ProvisioningModel } from "./registry";

/** Method ids the wizard UI + apply handlers branch on. */
export type ProvisioningMethodId = "usb" | "device" | "android" | "guided" | "export";

export interface ProvisioningMethod {
  id: ProvisioningMethodId;
  label: string;
  description: string;
  tag: string;
}

// One method per registry provisioning model. Copy is device-agnostic so the
// same mapping serves the Ally today and any device added later.
const MODEL_METHODS: Record<ProvisioningModel, ProvisioningMethod> = {
  "host-media-prep": {
    id: "usb",
    label: "Build a USB",
    description:
      "Build bootable media that wipes, installs and configures the device hands-off when it boots.",
    tag: "zero-touch",
  },
  "on-device": {
    id: "device",
    label: "Run on this device",
    description:
      "Apply the config now, on the device you're running bootible on — with restore points.",
    tag: "on-device",
  },
  "android-host": {
    id: "android",
    label: "Push over USB (ADB)",
    description: "Push the config to the device over a USB cable with ADB.",
    tag: "adb",
  },
  guided: {
    id: "guided",
    label: "Guided setup",
    description: "Step-by-step instructions for a device that can't be set up automatically.",
    tag: "manual",
  },
};

// Saving the config isn't a provisioning model — it's a cross-cutting option
// every device supports.
const EXPORT_METHOD: ProvisioningMethod = {
  id: "export",
  label: "Export the config",
  description: "Save this setup to your bootible account and a local file to reuse any time.",
  tag: "save",
};

/**
 * The provisioning methods available for a device — derived from its declared
 * provisioning_models, plus the universal config export. This is what makes the
 * method screen support any device type: add a registry entry and its methods
 * fall out of its provisioning_models.
 */
export function provisioningMethods(device: DeviceEntry): ProvisioningMethod[] {
  const fromModels = device.provisioning_models
    .map((model) => MODEL_METHODS[model])
    .filter((method): method is ProvisioningMethod => Boolean(method));
  return [...fromModels, EXPORT_METHOD];
}
