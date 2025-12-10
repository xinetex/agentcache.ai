CREATE TABLE "request_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_hash" text NOT NULL,
	"frequency" integer DEFAULT 1,
	"last_accessed" timestamp DEFAULT now(),
	"semantic_label" text,
	"avg_latency_ms" real,
	CONSTRAINT "request_patterns_pattern_hash_unique" UNIQUE("pattern_hash")
);
