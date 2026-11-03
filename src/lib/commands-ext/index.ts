/** Feature command modules, merged into the registry in ../commands.ts. */
import { billingModule } from "./billing";
import { channelsModule } from "./channels";
import { couriersModule } from "./couriers";
import { inventoryModule } from "./inventory";
import { platformModule } from "./platform";

export const EXT_COMMANDS = { ...couriersModule.commands, ...inventoryModule.commands, ...channelsModule.commands, ...platformModule.commands, ...billingModule.commands };
export const EXT_PERMISSIONS = { ...couriersModule.permissions, ...inventoryModule.permissions, ...channelsModule.permissions, ...platformModule.permissions, ...billingModule.permissions };
