import { IsString, IsMobilePhone, MinLength } from 'class-validator';

export class LoginDto {
  @IsMobilePhone('az-AZ')
  mobile: string;

  @IsString()
  @MinLength(6)
  password: string;
}
