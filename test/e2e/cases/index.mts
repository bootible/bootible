import { payloadCases, type Case } from "./payload.mts";
import { deckCases } from "./deck.mts";

export type { Case };
export const ALL_CASES: Case[] = [...payloadCases, ...deckCases];
