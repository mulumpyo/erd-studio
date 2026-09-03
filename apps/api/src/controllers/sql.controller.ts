import { Body, Controller, Post } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { generateSql, parseSql } from '@erd-studio/sql'
import { Auth } from '../common/auth/decorators'
import { ExportSqlDto, ImportSqlDto } from '../dto/sql.dto'

@ApiTags('sql')
@Controller('sql')
@Auth()
export class SqlController {
  @ApiOperation({
    summary: '다이어그램을 SQL로 내보내기',
    description:
      '다이어그램을 고른 데이터베이스 문법의 `CREATE TABLE` 문으로 바꿔줘요.\n\n' +
      '기본키, 외래키, 인덱스, 코멘트까지 함께 만들어요. 저장하지 않고 변환만 하니 프로젝트는 그대로예요.',
  })
  @ApiCreatedResponse({ description: '만들어진 SQL을 `sql` 값으로 줘요.' })
  @ApiBadRequestResponse({ description: '다이어그램 모양이나 문법 이름이 올바르지 않아요.' })
  @Post('export')
  exportSql(@Body() dto: ExportSqlDto) {
    return { sql: generateSql(dto.document, dto.dialect) }
  }

  @ApiOperation({
    summary: 'SQL을 다이어그램으로 읽어 들이기',
    description:
      '`CREATE TABLE` 문을 읽어서 다이어그램으로 만들어 줘요. 외래키는 관계선으로 바꿔요.\n\n' +
      '결과만 돌려주니, 마음에 들면 저장 API로 따로 저장해 주세요.',
  })
  @ApiCreatedResponse({ description: '읽어 들인 다이어그램을 `document` 값으로 줘요.' })
  @ApiBadRequestResponse({ description: 'SQL을 읽을 수 없어요. 문법을 확인해 주세요.' })
  @Post('import')
  importSql(@Body() dto: ImportSqlDto) {
    return { document: parseSql(dto.sql, dto.dialect) }
  }
}
