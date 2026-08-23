import { IsString, MinLength, MaxLength } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
