import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "@/lib/db/schema";

let client: Sql | null = null;
let database: PostgresJsDatabase<typeof schema> | null = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL?.trim();

    if (!url) {
      throw new Error("DATABASE_URL is required. Point it at any Postgres database.");
    }

    // Transaction-mode poolers reject prepared statements, so the same
    // connection string works whether it points at a pooler or at Postgres.
    client = postgres(url, { prepare: false });
  }

  return client;
}

export function getDb() {
  if (!database) {
    database = drizzle({ client: getClient(), schema });
  }

  return database;
}

const databaseProxyTarget = {} as PostgresJsDatabase<typeof schema>;

export const db = new Proxy(databaseProxyTarget, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export async function isDatabaseSchemaReady() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    const sql = getClient();
    const rows = await sql`
      select
        to_regclass('public.account') is not null as account_ready,
        to_regclass('public.chat') is not null as chat_ready,
        to_regclass('public.chat_event') is not null as chat_event_ready,
        to_regclass('public.session') is not null as session_ready,
        to_regclass('public."user"') is not null as user_ready,
        to_regclass('public.verification') is not null as verification_ready
    `;
    const result = rows[0];

    return (
      result?.account_ready === true &&
      result.chat_ready === true &&
      result.chat_event_ready === true &&
      result.session_ready === true &&
      result.user_ready === true &&
      result.verification_ready === true
    );
  } catch {
    return false;
  }
}
