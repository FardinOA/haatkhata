/**
 * Grants (or with --revoke, removes) HaatKhata super-admin access.
 *   npm run admin:grant -- 01711234567
 *   npm run admin:grant -- 01711234567 --revoke
 */
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { normalizePhone } from "../src/lib/domain";

async function main() {
  const args = process.argv.slice(2);
  const phone = normalizePhone(args.find((a) => !a.startsWith("--")) ?? "");
  const revoke = args.includes("--revoke");
  if (!phone) {
    console.error("Usage: npm run admin:grant -- 01XXXXXXXXX [--revoke]");
    process.exit(1);
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://bechakena:bechakena@localhost:55433/bechakena" });
  await c.connect();
  try {
    if (revoke) {
      const r = await c.query("update users set is_super_admin = false where phone = $1", [phone]);
      console.log(r.rowCount ? `Revoked super-admin from ${phone}` : `No user with phone ${phone}`);
    } else {
      await c.query("insert into users (id, phone, is_super_admin) values ($1, $2, true) on conflict (phone) do update set is_super_admin = true", [`u_${randomBytes(9).toString("base64url")}`, phone]);
      console.log(`${phone} is now a super-admin. Sign in with this number and open /admin.`);
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
