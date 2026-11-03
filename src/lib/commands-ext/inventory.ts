/**
 * Commands for the "inventory" feature area. Each is a pure, deterministic reducer
 * (see src/lib/commands.ts for the contract). Add commands here only.
 */
import type { CommandModule } from "../command-kit";

const commands = {};

export const inventoryModule: CommandModule<typeof commands> = { commands, permissions: {} };
