-- CreateTable
CREATE TABLE `boards` (
    `id` VARCHAR(12) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `prefix` VARCHAR(16) NOT NULL,
    `edit_hash` VARCHAR(255) NOT NULL,
    `next_seq` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cards` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `board_id` VARCHAR(12) NOT NULL,
    `seq` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` MEDIUMTEXT NULL,
    `status` ENUM('backlog', 'todo', 'doing', 'done') NOT NULL DEFAULT 'backlog',
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cards_board_id_status_idx`(`board_id`, `status`),
    UNIQUE INDEX `cards_board_id_seq_key`(`board_id`, `seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cards` ADD CONSTRAINT `cards_board_id_fkey` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
