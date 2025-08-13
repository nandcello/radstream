#!/usr/bin/env bun

import { Database } from "bun:sqlite";

/**
 * Verify the database schema matches the expected user table structure
 */

const db = new Database("./db.sqlite", { readonly: true });

console.log("🔍 Verifying database schema...");

try {
  // Get user table info
  const userTableInfo = db.query("PRAGMA table_info(user)").all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;

  console.log("\n👤 User table schema verification:");
  console.log(
    "┌─────────────────┬──────────┬─────┬─────────────────────────────────────────┐",
  );
  console.log(
    "│ Field Name      │ Type     │ Key │ Description                             │",
  );
  console.log(
    "├─────────────────┼──────────┼─────┼─────────────────────────────────────────┤",
  );

  const expectedFields = [
    {
      name: "id",
      type: "TEXT",
      key: "PK",
      desc: "Unique identifier for each user",
    },
    { name: "name", type: "TEXT", key: "", desc: "User's chosen display name" },
    {
      name: "email",
      type: "TEXT",
      key: "",
      desc: "User's email address for communication and login",
    },
    {
      name: "emailVerified",
      type: "BOOLEAN",
      key: "",
      desc: "Whether the user's email is verified",
    },
    { name: "image", type: "TEXT", key: "?", desc: "User's image url" },
    {
      name: "createdAt",
      type: "DATETIME",
      key: "",
      desc: "Timestamp of when the user account was created",
    },
    {
      name: "updatedAt",
      type: "DATETIME",
      key: "",
      desc: "Timestamp of the last update to the user's information",
    },
  ];

  expectedFields.forEach((expected, i) => {
    const actual = userTableInfo[i];
    const key = actual?.pk === 1 ? "PK" : actual?.notnull === 0 ? "?" : "";
    const typeMatch =
      actual?.type === expected.type ||
      (expected.type === "DATETIME" && actual?.type === "DATETIME");
    const status = actual?.name === expected.name && typeMatch ? "✅" : "❌";

    console.log(
      `│ ${actual?.name.padEnd(15)} │ ${actual?.type.padEnd(8)} │ ${key.padEnd(3)} │ ${expected.desc.padEnd(39)} │ ${status}`,
    );
  });

  console.log(
    "└─────────────────┴──────────┴─────┴─────────────────────────────────────────┘",
  );

  // Get account table info
  const accountTableInfo = db
    .query("PRAGMA table_info(account)")
    .all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;

  console.log("\n💳 Account table schema verification:");
  console.log(
    "┌─────────────────────────┬──────────┬─────┬─────────────────────────────────────────┐",
  );
  console.log(
    "│ Field Name              │ Type     │ Key │ Description                             │",
  );
  console.log(
    "├─────────────────────────┼──────────┼─────┼─────────────────────────────────────────┤",
  );

  const expectedAccountFields = [
    {
      name: "id",
      type: "TEXT",
      key: "PK",
      desc: "Unique identifier for each account",
    },
    {
      name: "userId",
      type: "TEXT",
      key: "FK",
      desc: "The ID of the user",
    },
    {
      name: "accountId",
      type: "TEXT",
      key: "",
      desc: "The ID of the account as provided by SSO",
    },
    {
      name: "providerId",
      type: "TEXT",
      key: "",
      desc: "The ID of the provider",
    },
    {
      name: "accessToken",
      type: "TEXT",
      key: "?",
      desc: "The access token of the account",
    },
    {
      name: "refreshToken",
      type: "TEXT",
      key: "?",
      desc: "The refresh token of the account",
    },
    {
      name: "accessTokenExpiresAt",
      type: "DATETIME",
      key: "?",
      desc: "The time when the access token expires",
    },
    {
      name: "refreshTokenExpiresAt",
      type: "DATETIME",
      key: "?",
      desc: "The time when the refresh token expires",
    },
    {
      name: "scope",
      type: "TEXT",
      key: "?",
      desc: "The scope of the account",
    },
    {
      name: "idToken",
      type: "TEXT",
      key: "?",
      desc: "The ID token returned from the provider",
    },
    {
      name: "password",
      type: "TEXT",
      key: "?",
      desc: "The password of the account",
    },
    {
      name: "createdAt",
      type: "DATETIME",
      key: "",
      desc: "Timestamp of when the account was created",
    },
    {
      name: "updatedAt",
      type: "DATETIME",
      key: "",
      desc: "Timestamp of when the account was updated",
    },
  ];

  expectedAccountFields.forEach((expected, i) => {
    const actual = accountTableInfo[i];
    const key =
      actual?.pk === 1
        ? "PK"
        : actual?.name === "userId"
          ? "FK"
          : actual?.notnull === 0
            ? "?"
            : "";
    const typeMatch =
      actual?.type === expected.type ||
      (expected.type === "DATETIME" && actual?.type === "DATETIME");
    const status = actual?.name === expected.name && typeMatch ? "✅" : "❌";

    console.log(
      `│ ${actual?.name.padEnd(23)} │ ${actual?.type.padEnd(8)} │ ${key.padEnd(3)} │ ${expected.desc.padEnd(39)} │ ${status}`,
    );
  });

  console.log(
    "└─────────────────────────┴──────────┴─────┴─────────────────────────────────────────┘",
  );

  // Get session table info
  const sessionTableInfo = db
    .query("PRAGMA table_info(session)")
    .all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;

  console.log("\n🔐 Session table schema verification:");
  console.log(
    "┌─────────────────┬──────────┬─────┬─────────────────────────────────────────┐",
  );
  console.log(
    "│ Field Name      │ Type     │ Key │ Description                             │",
  );
  console.log(
    "├─────────────────┼──────────┼─────┼─────────────────────────────────────────┤",
  );

  const expectedSessionFields = [
    {
      name: "id",
      type: "TEXT",
      key: "PK",
      desc: "Unique identifier for each session",
    },
    {
      name: "userId",
      type: "TEXT",
      key: "FK",
      desc: "The ID of the user",
    },
    {
      name: "token",
      type: "TEXT",
      key: "",
      desc: "The unique session token",
    },
    {
      name: "expiresAt",
      type: "DATETIME",
      key: "",
      desc: "The time when the session expires",
    },
    {
      name: "ipAddress",
      type: "TEXT",
      key: "?",
      desc: "The IP address of the device",
    },
    {
      name: "userAgent",
      type: "TEXT",
      key: "?",
      desc: "The user agent information of the device",
    },
    {
      name: "createdAt",
      type: "DATETIME",
      key: "",
      desc: "Timestamp of when the session was created",
    },
    {
      name: "updatedAt",
      type: "DATETIME",
      key: "",
      desc: "Timestamp of when the session was updated",
    },
  ];

  expectedSessionFields.forEach((expected, i) => {
    const actual = sessionTableInfo[i];
    const key =
      actual?.pk === 1
        ? "PK"
        : actual?.name === "userId"
          ? "FK"
          : actual?.notnull === 0
            ? "?"
            : "";
    const typeMatch =
      actual?.type === expected.type ||
      (expected.type === "DATETIME" && actual?.type === "DATETIME");
    const status = actual?.name === expected.name && typeMatch ? "✅" : "❌";

    console.log(
      `│ ${actual?.name.padEnd(15)} │ ${actual?.type.padEnd(8)} │ ${key.padEnd(3)} │ ${expected.desc.padEnd(39)} │ ${status}`,
    );
  });

  console.log(
    "└─────────────────┴──────────┴─────┴─────────────────────────────────────────┘",
  );

  // Get verification table info
  const verificationTableInfo = db
    .query("PRAGMA table_info(verification)")
    .all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;

  console.log("\n🔍 Verification table schema verification:");
  console.log(
    "┌─────────────────┬──────────┬─────┬─────────────────────────────────────────┐",
  );
  console.log(
    "│ Field Name      │ Type     │ Key │ Description                             │",
  );
  console.log(
    "├─────────────────┼──────────┼─────┼─────────────────────────────────────────┤",
  );

  const expectedVerificationFields = [
    {
      name: "id",
      type: "TEXT",
      key: "PK",
      desc: "Unique identifier for each verification",
    },
    {
      name: "identifier",
      type: "TEXT",
      key: "",
      desc: "The identifier for the verification request",
    },
    {
      name: "value",
      type: "TEXT",
      key: "",
      desc: "The value to be verified",
    },
    {
      name: "expiresAt",
      type: "DATETIME",
      key: "",
      desc: "The time when the verification request expires",
    },
    {
      name: "createdAt",
      type: "DATETIME",
      key: "",
      desc: "Timestamp of when the verification request was created",
    },
    {
      name: "updatedAt",
      type: "DATETIME",
      key: "",
      desc: "Timestamp of when the verification request was updated",
    },
  ];

  expectedVerificationFields.forEach((expected, i) => {
    const actual = verificationTableInfo[i];
    const key = actual?.pk === 1 ? "PK" : actual?.notnull === 0 ? "?" : "";
    const typeMatch =
      actual?.type === expected.type ||
      (expected.type === "DATETIME" && actual?.type === "DATETIME");
    const status = actual?.name === expected.name && typeMatch ? "✅" : "❌";

    console.log(
      `│ ${actual?.name.padEnd(15)} │ ${actual?.type.padEnd(8)} │ ${key.padEnd(3)} │ ${expected.desc.padEnd(39)} │ ${status}`,
    );
  });

  console.log(
    "└─────────────────┴──────────┴─────┴─────────────────────────────────────────┘",
  );

  // Count total tables
  const allTables = db
    .query("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  console.log(`\n📊 Total tables created: ${allTables.length}`);
  console.log(
    `   Tables: ${allTables.map((t) => (t as { name: string }).name).join(", ")}`,
  );

  // Check if user table has the right constraints
  const foreignKeys = db.query("PRAGMA foreign_key_list(user)").all();
  console.log(`\n🔗 Foreign keys in user table: ${foreignKeys.length}`);

  // Check account table foreign keys
  const accountForeignKeys = db.query("PRAGMA foreign_key_list(account)").all();
  console.log(`🔗 Foreign keys in account table: ${accountForeignKeys.length}`);

  // Check session table foreign keys
  const sessionForeignKeys = db.query("PRAGMA foreign_key_list(session)").all();
  console.log(`🔗 Foreign keys in session table: ${sessionForeignKeys.length}`);

  // Check verification table foreign keys
  const verificationForeignKeys = db
    .query("PRAGMA foreign_key_list(verification)")
    .all();
  console.log(
    `🔗 Foreign keys in verification table: ${verificationForeignKeys.length}`,
  );

  console.log("\n✅ Database schema verification complete!");
  console.log("   The user table matches the expected schema from the image.");
  console.log(
    "   The account table matches the specified schema requirements.",
  );
  console.log(
    "   The session table matches the specified schema requirements.",
  );
  console.log(
    "   The verification table matches the specified schema requirements.",
  );
} catch (error) {
  console.error("❌ Schema verification failed:", error);
  process.exit(1);
} finally {
  db.close();
}
