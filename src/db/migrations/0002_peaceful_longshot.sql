CREATE TABLE "tenant_hosts" (
	"hostname" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_hosts" ADD CONSTRAINT "tenant_hosts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_hosts_tenant_id_idx" ON "tenant_hosts" USING btree ("tenant_id");