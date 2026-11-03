import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "server-only": fileURLToPath(new URL("./src/server/test/server-only-stub.ts", import.meta.url)),
};

const testDb = process.env.BK_TEST_DB ?? "bechakena_test";

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", environment: "node", include: ["src/lib/**/*.test.ts", "src/components/**/*.test.ts"] } },
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          include: ["src/server/**/*.test.ts"],
          globalSetup: ["src/server/test/global-setup.ts"],
          env: { DATABASE_URL: `postgres://bechakena:bechakena@localhost:55433/${testDb}`, SMS_DRIVER: "console", AUTH_SECRET: "test-secret" },
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
