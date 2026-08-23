import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrackEventType } from '@prisma/client';

export class TrackEventDto {
  @IsEnum(TrackEventType)
  type!: TrackEventType;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  /** Millis since epoch when the event happened on the client. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  occurredAt?: number;
}

export class TrackBatchDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events!: TrackEventDto[];
}
