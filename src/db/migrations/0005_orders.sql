CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"config_id" text,
	"code" text NOT NULL,
	"customer_id" text,
	"contact_email" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text,
	"notes" text,
	"status" text NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"quote_snapshot" jsonb NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_config_id_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_tenant_id_idx" ON "orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");