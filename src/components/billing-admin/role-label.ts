"use client";

import { customRoleDef, isBuiltinRole } from "@/lib/domain";
import { useT } from "@/lib/hooks";
import { ROLE_LABEL } from "@/lib/labels";
import type { Role } from "@/lib/types";
import { useRoles } from "./roles-client";

/** Display name for any role, built-in or custom. */
export function useRoleLabel() {
  const t = useT();
  useRoles((s) => s.roles); // re-render when custom roles load
  return (role: Role) => {
    if (isBuiltinRole(role)) return t.pick(ROLE_LABEL[role]);
    const def = customRoleDef(role);
    return def ? (t.lang === "bn" && def.nameBn ? def.nameBn : def.name) : t("Custom role", "নিজস্ব রোল");
  };
}
