import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { ExcelParser } from './excel.parser';
import { ErpClient } from './erp.client';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [PassportModule, AuthModule],
  controllers: [SyncController],
  providers: [ExcelParser, ErpClient, SyncService],
  exports: [SyncService],
})
export class SyncModule {}
