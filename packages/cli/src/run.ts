import {
  type ArtifactSchemas,
  type DeviceEntry,
  type Executor,
  localTarget,
  restore,
  type SecretProvider,
} from "@bootible/core";

export interface CliEnv {
  stdout: (line: string) => void;
  schemas: ArtifactSchemas;
  registry: DeviceEntry[];
  secrets: SecretProvider;
  executor: Executor;
  workdir: string;
  savesDest: string;
}

export function run(argv: string[], env: CliEnv): number {
  const [command, ...rest] = argv;

  switch (command) {
    case "version":
    case "--version":
      env.stdout("bootible v2 (dev)");
      return 0;

    case "restore": {
      const targetDir = rest[0];
      if (!targetDir) {
        env.stdout("usage: bootible restore <target>");
        return 1;
      }
      const receipt = restore({
        target: localTarget(targetDir),
        registry: env.registry,
        schemas: env.schemas,
        secrets: env.secrets,
        executor: env.executor,
        workdir: env.workdir,
        savesDest: env.savesDest,
      });
      env.stdout(
        `restored ${receipt.device}: ${receipt.applied.length} action(s); saves ${
          receipt.savesRestored ? "restored" : "none"
        }`,
      );
      return 0;
    }

    default:
      if (!command || command === "help" || command === "--help") {
        env.stdout("bootible — usage: bootible <version | restore <target>>");
        return 0;
      }
      env.stdout(`unknown command "${command}". try: version | restore`);
      return 1;
  }
}
