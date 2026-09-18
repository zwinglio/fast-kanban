-- AlterTable
ALTER TABLE `boards` ADD COLUMN `dependencies_enabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `card_dependencies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `board_id` VARCHAR(12) NOT NULL,
    `blocked_id` INTEGER NOT NULL,
    `blocker_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `card_dependencies_board_id_idx`(`board_id`),
    INDEX `card_dependencies_blocker_id_idx`(`blocker_id`),
    UNIQUE INDEX `card_dependencies_blocked_id_blocker_id_key`(`blocked_id`, `blocker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `card_dependencies` ADD CONSTRAINT `card_dependencies_blocked_id_fkey` FOREIGN KEY (`blocked_id`) REFERENCES `cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_dependencies` ADD CONSTRAINT `card_dependencies_blocker_id_fkey` FOREIGN KEY (`blocker_id`) REFERENCES `cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
