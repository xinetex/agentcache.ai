CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'idle',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"action" text NOT NULL,
	"reasoning" text,
	"outcome" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"author_agent_id" uuid,
	"confidence" real DEFAULT 1,
	"last_verified_at" timestamp DEFAULT now(),
	CONSTRAINT "knowledge_nodes_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"tags" text[],
	"importance" real DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embedding_idx" ON "memories" USING hnsw ("embedding" vector_cosine_ops);