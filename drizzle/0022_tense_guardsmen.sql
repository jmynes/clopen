ALTER TABLE `expenses` ADD `cadence` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_expense_kind` text DEFAULT 'ride' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_ride_vendor` text DEFAULT 'uber' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_ride_direction` text DEFAULT 'to_work' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_meal_vendor` text DEFAULT 'uber_eats' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_meal_method` text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_purchase_vendor` text DEFAULT 'hardware' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_purchase_cadence` text DEFAULT 'monthly' NOT NULL;