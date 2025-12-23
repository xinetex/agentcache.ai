CREATE TABLE "cached_plan_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"plan_hash" text NOT NULL,
	"input_hash" text NOT NULL,
	"execution_trace" jsonb NOT NULL,
	"tokens_saved" integer,
	"cost_saved" real,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "plan_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sector" text,
	"steps" jsonb NOT NULL,
	"avg_cost" real,
	"avg_latency" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cached_plan_executions" ADD CONSTRAINT "cached_plan_executions_template_id_plan_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."plan_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_lookup_idx" ON "cached_plan_executions" USING btree ("plan_hash","input_hash");