import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/generated/prisma", "@/generated/prisma/*"],
              message:
                "Import the database client from @/lib/db; routes and components must go through module services.",
            },
          ],
        },
      ],
    },
  },
  {
    // Only the data/service layers, seeds and tests may touch Prisma directly; routes and components may not.
    files: ["src/lib/**", "src/modules/**", "src/integrations/**", "prisma/**", "tests/**", "scripts/**"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
