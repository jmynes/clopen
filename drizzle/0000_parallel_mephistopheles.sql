CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`hourly_rate` real DEFAULT 25 NOT NULL,
	`daily_hours` real DEFAULT 8 NOT NULL,
	`workdays` text DEFAULT '[1,2,3,4,5]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`hours` real NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
