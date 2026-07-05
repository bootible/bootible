import { payloadCases, type Case } from "./payload.mts";
import { deckCases } from "./deck.mts";
import { stripCases } from "./strip.mts";
import { bootstrapCases } from "./bootstrap.mts";
import { discoveryCases } from "./discovery.mts";

export type { Case };
export const ALL_CASES: Case[] = [
  ...payloadCases,
  ...deckCases,
  ...stripCases,
  ...bootstrapCases,
  ...discoveryCases,
];
