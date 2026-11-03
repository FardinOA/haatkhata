/**
 * Commands for the "platform" feature area. Each is a pure, deterministic reducer
 * (see src/lib/commands.ts for the contract). Add commands here only.
 */
import type { CommandModule } from "../command-kit";

const commands = {};

export const platformModule: CommandModule<typeof commands> = { commands, permissions: {} };
