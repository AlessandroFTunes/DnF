CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"edition" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"species_key" text,
	"background_key" text,
	"alignment_key" text,
	"feat_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"abilities" jsonb NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"inspiration" boolean DEFAULT false NOT NULL,
	"feature_uses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proficiencies" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"combat" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"equipment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"spellcasting" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"personality" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grid_scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"grid_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grids" (
	"id" text PRIMARY KEY NOT NULL,
	"mesa_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mesa_members" (
	"id" text PRIMARY KEY NOT NULL,
	"mesa_id" text NOT NULL,
	"user_id" text NOT NULL,
	"character_id" text NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mesas" (
	"id" text PRIMARY KEY NOT NULL,
	"gm_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"edition" text NOT NULL,
	"invite_code" text NOT NULL,
	"cover" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mesas_inviteCode_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "tts_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text DEFAULT '' NOT NULL,
	"nickname" text DEFAULT '' NOT NULL,
	"avatar" text,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_scenes" ADD CONSTRAINT "grid_scenes_grid_id_grids_id_fk" FOREIGN KEY ("grid_id") REFERENCES "public"."grids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grids" ADD CONSTRAINT "grids_mesa_id_mesas_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesa_members" ADD CONSTRAINT "mesa_members_mesa_id_mesas_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesa_members" ADD CONSTRAINT "mesa_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesa_members" ADD CONSTRAINT "mesa_members_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_gm_id_users_id_fk" FOREIGN KEY ("gm_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "characters_owner_id_index" ON "characters" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "grid_scenes_grid_id_index" ON "grid_scenes" USING btree ("grid_id");--> statement-breakpoint
CREATE INDEX "grids_mesa_id_index" ON "grids" USING btree ("mesa_id");--> statement-breakpoint
CREATE INDEX "mesa_members_mesa_id_index" ON "mesa_members" USING btree ("mesa_id");--> statement-breakpoint
CREATE INDEX "mesa_members_user_id_index" ON "mesa_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mesa_members_character_id_index" ON "mesa_members" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "mesas_gm_id_index" ON "mesas" USING btree ("gm_id");