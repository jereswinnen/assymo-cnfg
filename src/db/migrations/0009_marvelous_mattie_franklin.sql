CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"category" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"textures" jsonb,
	"tile_size" jsonb,
	"pricing" jsonb NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "materials_tenant_category_slug_idx" ON "materials" USING btree ("tenant_id","category","slug");--> statement-breakpoint
CREATE INDEX "materials_tenant_id_idx" ON "materials" USING btree ("tenant_id");