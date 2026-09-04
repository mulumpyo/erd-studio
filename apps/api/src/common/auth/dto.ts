import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @ApiProperty({
    description: '가입할 이메일이에요. 인증 링크를 이 주소로 보내요.',
    example: 'hong@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string

  @ApiProperty({
    description: '쓸 비밀번호예요. 8자 이상으로 정해 주세요.',
    example: 'erd-studio-1234',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string

  @ApiProperty({
    description: '팀원에게 보일 이름이에요.',
    example: '홍길동',
    minLength: 1,
    maxLength: 80,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string

  @ApiPropertyOptional({
    description:
      '이메일 인증을 마친 뒤 돌아갈 경로예요. 초대 링크로 들어왔을 때 쓰고, 같은 사이트 경로만 받아요.',
    example: '/invite/abc123',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextPath?: string
}

export class LoginDto {
  @ApiProperty({
    description: '가입할 때 쓴 이메일이에요.',
    example: 'hong@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string

  @ApiProperty({
    description: '비밀번호예요.',
    example: 'erd-studio-1234',
    minLength: 1,
    maxLength: 72,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string
}

export class VerifyEmailDto {
  @ApiProperty({
    description: '인증 메일 링크에 담긴 토큰이에요. 24시간 동안 쓸 수 있어요.',
    example: 'F3sQ1t0pV9xK7mB2nR8yZ4wL6cJ5hD0a',
  })
  @IsString()
  @MinLength(1)
  token: string
}

export class ResendVerificationDto {
  @ApiProperty({
    description: '인증 메일을 다시 받을 이메일이에요.',
    example: 'hong@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      '리프레시 토큰이에요. 보통은 `erd_refresh` 쿠키로 자동 전달되니 비워 두면 돼요.',
    example: 'Qk9tYS1yZWZyZXNoLXRva2Vu',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  refreshToken?: string
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: '재설정 링크를 받을 이메일이에요.',
    example: 'hong@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string
}

export class ResetPasswordDto {
  @ApiProperty({
    description: '재설정 메일 링크에 담긴 토큰이에요. 2시간 동안 쓸 수 있어요.',
    example: 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6',
  })
  @IsString()
  @MinLength(1)
  token: string

  @ApiProperty({
    description: '새로 쓸 비밀번호예요. 8자 이상으로 정해 주세요.',
    example: 'erd-studio-5678',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string
}

export class DeleteAccountDto {
  @ApiProperty({
    description: '지금 쓰고 있는 비밀번호예요. 탈퇴할 때 한 번 더 확인해요.',
    example: 'erd-studio-1234',
    minLength: 1,
    maxLength: 72,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string
}

export class ChangePasswordDto {
  @ApiProperty({
    description: '지금 쓰고 있는 비밀번호예요.',
    example: 'erd-studio-1234',
    minLength: 1,
    maxLength: 72,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string

  @ApiProperty({
    description: '새로 쓸 비밀번호예요. 바꾸면 모든 기기에서 로그아웃돼요.',
    example: 'erd-studio-5678',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string
}

export class AuthUserDto {
  @ApiProperty({
    description: '사용자 ID예요.',
    example: 'clz9k2p4x0005s601ghijklmn',
  })
  id: string

  @ApiProperty({
    description: '로그인에 쓰는 이메일이에요.',
    example: 'hong@example.com',
    format: 'email',
  })
  email: string

  @ApiProperty({
    description: '팀원에게 보일 이름이에요.',
    example: '홍길동',
  })
  name: string

  @ApiProperty({
    description:
      '플랫폼 관리자면 true예요. 팀·프로젝트 역할과 따로예요. `/admin`은 이 값이 true일 때만 열 수 있어요.',
    example: false,
  })
  isAdmin: boolean
}

export class SessionResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto

  @ApiProperty({
    description: '액세스 토큰이 만료되는 시각이에요. 밀리초예요.',
    example: 1710000000000,
  })
  expiresAt: number

  @ApiPropertyOptional({
    description:
      '이메일 인증 뒤에 돌아갈 경로예요. 초대 링크로 들어왔을 때만 있어요.',
    example: '/invite/abc123',
  })
  nextPath?: string
}
