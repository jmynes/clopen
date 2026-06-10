CREATE TABLE `open_shift` (
	`id` text PRIMARY KEY DEFAULT 'current' NOT NULL,
	`started_at` integer,
	`break_started_at` integer,
	`break_seconds` integer DEFAULT 0 NOT NULL,
	`break_mode` text DEFAULT 'accrue' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `time_zone` text DEFAULT 'America/Chicago' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `observe_dst` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `clock_break_mode` text DEFAULT 'accrue' NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `updated_at` integer;