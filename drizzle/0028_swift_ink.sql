CREATE TABLE `bonus_events` (
	`id` text PRIMARY KEY NOT NULL,
	`bonus_id` text NOT NULL,
	`action` text NOT NULL,
	`at` integer NOT NULL,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bonuses` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`label` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
