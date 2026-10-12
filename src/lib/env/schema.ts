import { z } from "zod";

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, "must be a postgres:// or postgresql:// connection string");

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    DATABASE_URL: postgresUrl,
    TEST_DATABASE_URL: postgresUrl.optional(),
    SHELL_PREVIEW: z.stringbool().default(false),
    AUTH_SECRET: z.string().min(32, "must be at least 32 characters (generate with: openssl rand -base64 32)"),
    /** Email delivery provider. "none" means unconfigured: nothing is ever reported as sent. */
    EMAIL_PROVIDER: z.enum(["none"]).default("none"),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default("storage/uploads"),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === "production") {
      if (env.SHELL_PREVIEW) {
        ctx.addIssue({
          code: "custom",
          path: ["SHELL_PREVIEW"],
          message: "SHELL_PREVIEW must be false in production",
        });
      }
      if (env.STORAGE_DRIVER === "local") {
        ctx.addIssue({ code: "custom", path: ["STORAGE_DRIVER"], message: "local storage is for development only" });
      }
      if (!env.APP_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "APP_URL must use https in production" });
      }
    }
    if (env.TEST_DATABASE_URL && env.TEST_DATABASE_URL === env.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["TEST_DATABASE_URL"],
        message: "TEST_DATABASE_URL must differ from DATABASE_URL",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parses raw environment values; throws one readable error listing every invalid variable. */
export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
