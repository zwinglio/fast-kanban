-- AlterTable
ALTER TABLE `cards` ADD COLUMN `priority_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `priorities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `board_id` VARCHAR(12) NOT NULL,
    `name` VARCHAR(30) NOT NULL,
    `color` VARCHAR(7) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `priorities_board_id_idx`(`board_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `cards_priority_id_idx` ON `cards`(`priority_id`);

-- AddForeignKey
ALTER TABLE `priorities` ADD CONSTRAINT `priorities_board_id_fkey` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cards` ADD CONSTRAINT `cards_priority_id_fkey` FOREIGN KEY (`priority_id`) REFERENCES `priorities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the default priorities for every existing board (cards start with no priority)
INSERT INTO `priorities` (`board_id`, `name`, `color`, `position`)
SELECT b.`id`, 'Urgent', '#ff5630', 0 FROM `boards` b
UNION ALL
SELECT b.`id`, 'High', '#ffab00', 1 FROM `boards` b
UNION ALL
SELECT b.`id`, 'Medium', '#4c9aff', 2 FROM `boards` b
UNION ALL
SELECT b.`id`, 'Low', '#5e6c84', 3 FROM `boards` b;
