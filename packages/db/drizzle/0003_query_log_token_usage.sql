ALTER TABLE "query_logs"
ADD COLUMN IF NOT EXISTS "answer_model" text,
ADD COLUMN IF NOT EXISTS "input_tokens" integer,
ADD COLUMN IF NOT EXISTS "output_tokens" integer,
ADD COLUMN IF NOT EXISTS "total_tokens" integer;
