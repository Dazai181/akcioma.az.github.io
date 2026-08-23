import { IsString, Length, IsMobilePhone } from 'class-validator';

export class VerifyOtpDto {
  @IsMobilePhone('tr-TR')
  mobile: string;

  @IsString()
  @Length(6, 6, { message: 'OTP 6 haneli olmalıdır.' })
  otp: string;
}
