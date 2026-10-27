ALTER TABLE "matches" ADD COLUMN "status_detail" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "league_name" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "league_logo" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "home_logo" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "away_logo" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "venue" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "elapsed" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "last_refreshed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "commentary_match_id_idx" ON "commentary" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "commentary_external_id_idx" ON "commentary" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "matches_sport_status_idx" ON "matches" USING btree ("sport","status");--> statement-breakpoint
CREATE INDEX "matches_start_time_idx" ON "matches" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "matches_external_id_idx" ON "matches" USING btree ("external_id");