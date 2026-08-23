import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CustomerTier } from '@prisma/client';

export class TierPriceDto {
  @IsEnum(CustomerTier)
  tier!: CustomerTier;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
}

export class UpsertProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQty!: number;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TierPriceDto)
  prices!: TierPriceDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
