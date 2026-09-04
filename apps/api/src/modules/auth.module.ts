import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from '../services/auth.service'
import { requireJwtSecret } from '../config/secrets'
import { AuthController } from '../controllers/auth.controller'
import { JwtStrategy } from '../common/auth/jwt.strategy'
import { RefreshTokenService } from '../services/refresh-token.service'
import { AccessTokenService } from '../services/access-token.service'
import { UsageModule } from './usage.module'

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: requireJwtSecret(),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: (process.env.JWT_EXPIRES ?? '15m') as
            | `${number}s`
            | `${number}m`
            | `${number}h`
            | `${number}d`,
        },
      }),
    }),
    UsageModule,
  ],
  providers: [AuthService, JwtStrategy, RefreshTokenService, AccessTokenService],
  controllers: [AuthController],
  exports: [JwtModule, RefreshTokenService],
})
export class AuthModule {}
