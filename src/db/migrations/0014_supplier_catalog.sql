CREATE TABLE "supplier_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"hero_image" text,
	"width_mm" integer NOT NULL,
	"height_mm" integer NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_products_tenant_kind_sku_idx" ON "supplier_products" USING btree ("tenant_id","kind","sku");--> statement-breakpoint
CREATE INDEX "idx_supplier_products_tenant_supplier" ON "supplier_products" USING btree ("tenant_id","supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_products_tenant_kind" ON "supplier_products" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_tenant_slug_idx" ON "suppliers" USING btree ("tenant_id","slug");