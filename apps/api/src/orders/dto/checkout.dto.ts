import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ShippingAddressDto {
  @IsString()
  @Length(2, 80)
  fullName!: string;

  @IsString()
  @Length(3, 80)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsString()
  @MaxLength(200)
  addressLine!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;
}

export class CheckoutDto {
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @IsString()
  @Length(7, 20)
  contactPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
