-- AlterTable
ALTER TABLE `cards` ADD COLUMN `uuid` CHAR(36) NULL;

-- Backfill existing cards (UUID() is evaluated per row)
UPDATE `cards` SET `uuid` = UUID();

-- Make it required and unique
ALTER TABLE `cards` MODIFY `uuid` CHAR(36) NOT NULL;

CREATE UNIQUE INDEX `cards_uuid_key` ON `cards`(`uuid`);
