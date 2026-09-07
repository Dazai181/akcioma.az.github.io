import { IsString, Length, IsMobilePhone } from 'class-validator';

export class VerifyOtpDto {
  @IsMobilePhone('az-AZ')
  mobile: string;

  @IsString()
  @Length(6, 6, { message: 'OTP 6 haneli olmalıdır.' })
  otp: string;
}
