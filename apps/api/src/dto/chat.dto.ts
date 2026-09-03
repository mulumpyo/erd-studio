import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class ChatDto {
  @ApiProperty({
    description: '보낼 메시지예요.',
    example: '주문 테이블에 상태 컬럼 추가했어요!',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string
}
