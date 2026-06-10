CREATE TABLE `entry_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`action` text NOT NULL,
	`at` integer NOT NULL,
	`snapshot` text NOT NULL
);
