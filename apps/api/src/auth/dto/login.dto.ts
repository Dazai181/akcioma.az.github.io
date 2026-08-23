import { IsString, IsMobilePhone, MinLength } from 'class-validator';

export class LoginDto {
  @IsMobilePhone('tr-TR')
  mobile: string;

  @IsString()
  @MinLength(6)
  password: string;
}
