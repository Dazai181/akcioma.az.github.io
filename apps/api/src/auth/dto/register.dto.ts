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

  @IsMobilePhone('tr-TR', {}, { message: 'Geçerli bir Türkiye telefon numarası giriniz.' })
  mobile: string;
}
