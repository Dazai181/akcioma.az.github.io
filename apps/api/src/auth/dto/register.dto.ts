import { IsString, IsMobilePhone, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @IsMobilePhone('az-AZ', {}, { message: 'Geçerli bir telefon numarası giriniz.' })
  mobile: string;
}
