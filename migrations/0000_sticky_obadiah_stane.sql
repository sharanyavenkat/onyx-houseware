-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`username` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`product_type` text NOT NULL,
	`size_specification` text NOT NULL,
	`price` real NOT NULL,
	`safety_stock` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`company_name` text NOT NULL,
	`contact_person` text,
	`phone` text,
	`email` text,
	`address` text
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`po_number` text NOT NULL,
	`customer_id` integer NOT NULL,
	`order_date` text NOT NULL,
	`fulfillment_date` text,
	`status` text DEFAULT 'draft' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`order_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `indents` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`item_id` integer NOT NULL,
	`month` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`expected_receipts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`order_id` integer NOT NULL,
	`order_item_id` integer NOT NULL,
	`lot_number` text,
	`quantity_shipped` integer NOT NULL,
	`rejections_blowholes` integer DEFAULT 0 NOT NULL,
	`rejections_handles` integer DEFAULT 0 NOT NULL,
	`rejections_other` integer DEFAULT 0 NOT NULL,
	`shipment_date` text NOT NULL,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);

*/