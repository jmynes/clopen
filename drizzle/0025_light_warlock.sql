ALTER TABLE `settings` ALTER COLUMN "goal_enabled" TO "goal_enabled" integer NOT NULL DEFAULT true;--> statement-breakpoint
UPDATE `settings` SET `goal_enabled` = 1 WHERE `id` = 'default';
