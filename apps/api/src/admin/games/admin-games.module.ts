import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../../auth/auth.module';
import { AdminGamesController } from './admin-games.controller';
import { AdminGamesService } from './admin-games.service';

@Module({
  imports: [PassportModule, AuthModule],
  controllers: [AdminGamesController],
  providers: [AdminGamesService],
})
export class AdminGamesModule {}
