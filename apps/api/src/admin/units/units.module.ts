import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../../auth/auth.module';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { PublicUnitsController } from './public-units.controller';

@Module({
  imports: [PassportModule, AuthModule],
  controllers: [UnitsController, PublicUnitsController],
  providers: [UnitsService],
})
export class UnitsModule {}
