CREATE TYPE "user_role" AS ENUM ('admin');

CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "role" "user_role" NOT NULL DEFAULT 'admin',
  "password_hash" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "users_workspace_email_idx" ON "users" ("workspace_id", "email");

CREATE TABLE "auth_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "session_token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "auth_sessions_token_hash_idx" ON "auth_sessions" ("session_token_hash");
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" ("user_id");

CREATE TABLE "encrypted_secrets" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces" ("id") ON DELETE cascade,
  "scope" text NOT NULL,
  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "key_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "encrypted_secrets_workspace_scope_idx" ON "encrypted_secrets" ("workspace_id", "scope");
