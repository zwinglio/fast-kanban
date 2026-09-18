-- CreateTable
CREATE TABLE `card_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `card_id` INTEGER NOT NULL,
    `board_id` VARCHAR(12) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `data` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `card_events_card_id_id_idx`(`card_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `card_events` ADD CONSTRAINT `card_events_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing card gets a "created" entry (and "archived" where it applies),
-- so no card starts with an empty history.
INSERT INTO `card_events` (`card_id`, `board_id`, `type`, `data`, `created_at`)
SELECT c.`id`, c.`board_id`, 'created', JSON_OBJECT('column', col.`name`), c.`created_at`
FROM `cards` c
JOIN `board_columns` col ON col.`id` = c.`column_id`;

INSERT INTO `card_events` (`card_id`, `board_id`, `type`, `data`, `created_at`)
SELECT c.`id`, c.`board_id`, 'archived', NULL, c.`archived_at`
FROM `cards` c
WHERE c.`archived_at` IS NOT NULL;
