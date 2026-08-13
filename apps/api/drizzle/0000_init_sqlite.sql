CREATE TABLE `campuses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`hierarchy_mode` text DEFAULT 'full' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campuses_slug_unique` ON `campuses` (`slug`);
--> statement-breakpoint
CREATE TABLE `buildings` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buildings_campus_id_slug_unique` ON `buildings` (`campus_id`,`slug`);
--> statement-breakpoint
CREATE TABLE `floors` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`building_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `floors_building_id_slug_unique` ON `floors` (`building_id`,`slug`) WHERE `building_id` is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX `floors_campus_id_slug_unique` ON `floors` (`campus_id`,`slug`) WHERE `building_id` is null;
--> statement-breakpoint
CREATE TABLE `floor_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`floor_id` text NOT NULL,
	`file_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer,
	`height` integer,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`floor_id`) REFERENCES `floors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `floor_plans_floor_id_unique` ON `floor_plans` (`floor_id`);
--> statement-breakpoint
CREATE TABLE `features` (
	`id` text PRIMARY KEY NOT NULL,
	`floor_id` text NOT NULL,
	`type` text NOT NULL,
	`geometry` text NOT NULL,
	`label` text,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`floor_id`) REFERENCES `floors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `feature_media` (
	`id` text PRIMARY KEY NOT NULL,
	`feature_id` text NOT NULL,
	`file_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feature_media_feature_id_idx` ON `feature_media` (`feature_id`);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_username_unique` ON `admin_users` (`username`);
--> statement-breakpoint
CREATE TABLE `layer_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`feature_types` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `layer_presets_slug_unique` ON `layer_presets` (`slug`);
