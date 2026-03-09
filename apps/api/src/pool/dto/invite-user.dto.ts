import { IsString, IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({ description: 'Email address of user to invite', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
