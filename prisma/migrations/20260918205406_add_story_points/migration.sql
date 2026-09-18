-- AlterTable
ALTER TABLE `boards` ADD COLUMN `points_enabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `cards` ADD COLUMN `points` INTEGER NULL;
