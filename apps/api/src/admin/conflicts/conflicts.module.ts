import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../../auth/auth.module';
import { ConflictsController } from './conflicts.controller';
import { ConflictsService } from './conflicts.service';

@Module({
  imports: [PassportModule, AuthModule],
  controllers: [ConflictsController],
  providers: [ConflictsService],
})
export class ConflictsModule {}
