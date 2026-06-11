CREATE TABLE `expense_events` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`action` text NOT NULL,
	`at` integer NOT NULL,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`kind` text DEFAULT 'ride' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `goal_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `yearly_goal` real DEFAULT 80000 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `count_expenses` integer DEFAULT true NOT NULL;