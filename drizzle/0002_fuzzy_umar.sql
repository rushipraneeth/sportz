ALTER TABLE "commentary" ADD COLUMN "external_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "external_id" integer;--> statement-breakpoint
ALTER TABLE "commentary" ADD CONSTRAINT "commentary_external_id_unique" UNIQUE("external_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_external_id_unique" UNIQUE("external_id");