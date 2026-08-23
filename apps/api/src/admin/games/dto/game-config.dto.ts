import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { RewardType } from '@prisma/client';

export class UpdateGameDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cooldownHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPlaysPerDay?: number;
}

export class UpsertRewardDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsEnum(RewardType)
  type!: RewardType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  weight!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
