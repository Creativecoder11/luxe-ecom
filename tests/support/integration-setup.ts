// Runs before every integration test file: point the application's database client at the test DB.
import "dotenv/config";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/_test(\?|$)/.test(testUrl)) {
  throw new Error("Integration tests require TEST_DATABASE_URL pointing at a *_test database.");
}
process.env.DATABASE_URL = testUrl;
// The app config rejects TEST_DATABASE_URL === DATABASE_URL; inside the test process only one database exists.
delete process.env.TEST_DATABASE_URL;
process.env.APP_ENV = "test";
process.env.LOG_LEVEL = "silent";
