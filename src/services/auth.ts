import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";

if (
  !process.env.GOOGLE_OAUTH_CLIENT_ID ||
  !process.env.GOOGLE_OAUTH_CLIENT_SECRET
) {
  throw new Error("Missing Google OAuth environment variables.");
}

const getLocalDb = () => {
  const db = new Database("./db.sqlite", { create: true });
  return db;
};

export const auth = betterAuth({
  database: getLocalDb(),
  socialProviders: {
    google: {
      prompt: "select_account+consent",
      accessType: "offline",
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      scope: ["https://www.googleapis.com/auth/youtube"],
    },
  },
});
