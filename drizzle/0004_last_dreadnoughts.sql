CREATE TABLE "agent_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"status" text DEFAULT 'open',
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "auto_topoff_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false,
	"threshold_credits" real DEFAULT 100,
	"topoff_package" text DEFAULT 'pack_2500',
	"stripe_payment_method_id" text,
	"last_topoff_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "auto_topoff_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "bancache" (
	"hash" text PRIMARY KEY NOT NULL,
	"banner_text" text NOT NULL,
	"first_seen_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now(),
	"seen_count" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "banner_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"banner_hash" text,
	"agent_model" text NOT NULL,
	"risk_score" real,
	"classification" text,
	"vulnerabilities" jsonb,
	"compliance" jsonb,
	"reasoning" text,
	"analyzed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"balance_after" real NOT NULL,
	"description" text,
	"package_id" text,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"service" text,
	"resource_id" text,
	"quantity" real,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"cache_reads" integer DEFAULT 0,
	"cache_writes" integer DEFAULT 0,
	"cache_semantic" integer DEFAULT 0,
	"ai_embeddings" integer DEFAULT 0,
	"ai_completions_tokens" integer DEFAULT 0,
	"transcode_minutes" real DEFAULT 0,
	"storage_gb" real DEFAULT 0,
	"egress_gb" real DEFAULT 0,
	"edge_invocations" integer DEFAULT 0,
	"total_credits_used" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "auto_topoff_settings" ADD CONSTRAINT "auto_topoff_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banner_analysis" ADD CONSTRAINT "banner_analysis_banner_hash_bancache_hash_fk" FOREIGN KEY ("banner_hash") REFERENCES "public"."bancache"("hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_usage_daily" ADD CONSTRAINT "credit_usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_tx_user_idx" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_tx_created_idx" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credit_tx_type_idx" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "credit_usage_daily_user_date_idx" ON "credit_usage_daily" USING btree ("user_id","date");