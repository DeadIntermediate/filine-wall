CREATE TABLE `access_control` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` text NOT NULL,
	`resource` text NOT NULL,
	`permissions` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_control_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocking_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rule_type` text NOT NULL,
	`is_enabled` boolean DEFAULT true,
	`priority` int DEFAULT 0,
	`conditions` json NOT NULL,
	`action` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocking_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone_number` text NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`action` text NOT NULL,
	`duration` text,
	`metadata` json,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`caller_id` json NOT NULL,
	`carrier_info` json,
	`line_type` text,
	`time_of_day` int,
	`day_of_week` int,
	`device_id` text,
	CONSTRAINT `call_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `call_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone_number` text NOT NULL,
	`pattern_type` text NOT NULL,
	`pattern_data` json NOT NULL,
	`confidence` decimal(5,2) NOT NULL,
	`detected_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`active` boolean DEFAULT true,
	CONSTRAINT `call_patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `device_configurations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`name` text NOT NULL,
	`ip_address` text,
	`port` int,
	`device_path` text,
	`device_type` text NOT NULL,
	`connection_type` text NOT NULL DEFAULT ('network'),
	`status` text NOT NULL DEFAULT ('offline'),
	`last_heartbeat` timestamp,
	`auth_token` text NOT NULL,
	`settings` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `device_configurations_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_configurations_device_id_unique` UNIQUE(`device_id`)
);
--> statement-breakpoint
CREATE TABLE `device_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`name` text NOT NULL,
	`device_type` text NOT NULL,
	`public_key` text NOT NULL,
	`auth_token` text NOT NULL,
	`encryption_key` text NOT NULL,
	`status` text NOT NULL DEFAULT ('pending'),
	`registered_at` timestamp NOT NULL DEFAULT (now()),
	`last_active` timestamp,
	`metadata` json,
	CONSTRAINT `device_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_registrations_device_id_unique` UNIQUE(`device_id`)
);
--> statement-breakpoint
CREATE TABLE `feature_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feature_key` text NOT NULL,
	`is_enabled` boolean DEFAULT true,
	`configuration` json,
	`display_order` int,
	`category` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feature_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `feature_settings_feature_key_unique` UNIQUE(`feature_key`)
);
--> statement-breakpoint
CREATE TABLE `geo_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`region` text NOT NULL,
	`risk_level` decimal(5,2) NOT NULL,
	`blocking_enabled` boolean DEFAULT false,
	`rules` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geo_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phone_numbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`active` boolean DEFAULT true,
	`dnc_status` json,
	`reputation_score` decimal(5,2) DEFAULT '50',
	`last_score_update` timestamp DEFAULT (now()),
	`score_factors` json,
	`caller_id_info` json,
	`blocking_rules` json,
	CONSTRAINT `phone_numbers_id` PRIMARY KEY(`id`),
	CONSTRAINT `phone_numbers_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`last_activity` timestamp,
	`device_info` json,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `spam_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone_number` text NOT NULL,
	`reported_at` timestamp NOT NULL DEFAULT (now()),
	`category` text NOT NULL,
	`description` text,
	`status` text NOT NULL DEFAULT ('pending'),
	`confirmations` int NOT NULL DEFAULT 1,
	`metadata` json,
	`reporter_score` decimal(5,2),
	`audio_sample_url` text,
	`location` json,
	CONSTRAINT `spam_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`quiet_hours_start` int,
	`quiet_hours_end` int,
	`risk_threshold` decimal(5,2) DEFAULT '0.7',
	`block_categories` json,
	`allow_known_callers` boolean DEFAULT true,
	`block_international` boolean DEFAULT false,
	`block_unknown` boolean DEFAULT false,
	`block_without_caller_id` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL DEFAULT ('user'),
	`email` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_login` timestamp,
	`active` boolean DEFAULT true,
	`preferences` json,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone_number` text NOT NULL,
	`code` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`used` boolean DEFAULT false,
	`verified_at` timestamp,
	`metadata` json,
	CONSTRAINT `verification_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voice_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pattern_type` text NOT NULL,
	`features` json NOT NULL,
	`confidence` decimal(5,2) NOT NULL,
	`language` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`metadata` json,
	`active` boolean DEFAULT true,
	CONSTRAINT `voice_patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;