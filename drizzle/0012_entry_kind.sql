-- Replace the boolean is_pto flag with a richer `entry_kind` enum so we can
-- track sick days, holidays, vacations (paid and unpaid) in addition to PTO.
ALTER TABLE `time_entries` ADD COLUMN `entry_kind` text DEFAULT 'work' NOT NULL;
--> statement-breakpoint
UPDATE `time_entries` SET `entry_kind` = 'pto' WHERE `is_pto` = 1;
--> statement-breakpoint
UPDATE `time_entries` SET `entry_kind` = 'vacation_unpaid' WHERE `note` = 'Unpaid Vacation';
--> statement-breakpoint
ALTER TABLE `time_entries` DROP COLUMN `is_pto`;
