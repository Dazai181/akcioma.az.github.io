import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CustomerTier } from '@prisma/client';

export type ResolutionAction = 'KEEP_EXISTING' | 'APPLY_INCOMING' | 'MERGE';

export class MergedPriceDto {
  @IsEnum(CustomerTier)
  tier!: CustomerTier;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
}

export class MergedDataDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  categorySlug!: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQty!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MergedPriceDto)
  prices!: MergedPriceDto[];
}

export class ResolveConflictDto {
  @IsEnum(['KEEP_EXISTING', 'APPLY_INCOMING', 'MERGE'])
  action!: ResolutionAction;

  /** Required when action === 'MERGE'. */
  @IsOptional()
  @ValidateNested()
  @Type(() => MergedDataDto)
  mergedData?: MergedDataDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
