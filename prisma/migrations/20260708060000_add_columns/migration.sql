-- CreateTable
CREATE TABLE `board_columns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `board_id` VARCHAR(12) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `color` VARCHAR(7) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `board_columns_board_id_idx`(`board_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `board_columns` ADD CONSTRAINT `board_columns_board_id_fkey` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default columns for every existing board
INSERT INTO `board_columns` (`board_id`, `name`, `color`, `position`)
SELECT b.`id`, 'Backlog', '#5e6c84', 0 FROM `boards` b
UNION ALL
SELECT b.`id`, 'Todo', '#4c9aff', 1 FROM `boards` b
UNION ALL
SELECT b.`id`, 'Doing', '#0052cc', 2 FROM `boards` b
UNION ALL
SELECT b.`id`, 'Done', '#36b37e', 3 FROM `boards` b;

-- Add nullable column_id to cards
ALTER TABLE `cards` ADD COLUMN `column_id` INTEGER NULL;

-- Backfill column_id by matching each card's status to the corresponding column
UPDATE `cards` c
JOIN `board_columns` col ON col.`board_id` = c.`board_id`
SET c.`column_id` = col.`id`
WHERE
  (c.`status` = 'backlog' AND col.`name` = 'Backlog')
  OR (c.`status` = 'todo' AND col.`name` = 'Todo')
  OR (c.`status` = 'doing' AND col.`name` = 'Doing')
  OR (c.`status` = 'done' AND col.`name` = 'Done');

-- Make column_id NOT NULL
ALTER TABLE `cards` MODIFY COLUMN `column_id` INTEGER NOT NULL;

-- Add FK and index for column_id
ALTER TABLE `cards` ADD CONSTRAINT `cards_column_id_fkey` FOREIGN KEY (`column_id`) REFERENCES `board_columns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old index and create new one
ALTER TABLE `cards` DROP INDEX `cards_board_id_status_idx`;
CREATE INDEX `cards_board_id_column_id_idx` ON `cards`(`board_id`, `column_id`);

-- Drop the status column
ALTER TABLE `cards` DROP COLUMN `status`;

