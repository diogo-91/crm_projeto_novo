import {
  readRefreshCookie,
  refreshCookieName,
  refreshCookieOptions,
} from '../../../common/auth-cookie.js';
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiCookieAuth,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { ApiConfig } from '@crm/config/server';
import {
  loginSchema,
  emptyBodySchema,
  selectContextSchema,
  changePasswordSchema,
  authResponseSchema,
  meResponseSchema,
} from '@crm/contracts';
import type { Login, ChangePassword } from '@crm/contracts';
import {
  CookieFlow,
  PublicEndpoint,
  IdentityEndpoint,
  CurrentPrincipal,
} from '../../../common/security.js';
import type { Principal } from '../../../common/security.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import { openApiSchema } from '../../../common/openapi-schema.js';
import { RUNTIME_CONFIG } from '../../runtime/index.js';
import { AuthService } from '../application/auth.service.js';
@ApiTags('auth')
@ApiResponse({ status: 400, description: 'Invalid input' })
@ApiResponse({ status: 401, description: 'Invalid credentials or session' })
@ApiResponse({ status: 403, description: 'Origin or organization context rejected' })
@ApiResponse({
  status: 429,
  description: 'Authentication attempts exceeded; Retry-After in seconds',
})
@ApiResponse({ status: 503, description: 'Authentication infrastructure unavailable' })
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RUNTIME_CONFIG) private readonly config: ApiConfig,
  ) {}
  private cookie(response: Response, token: string, expiresAt: string) {
    response.cookie(refreshCookieName(this.config), token, {
      ...refreshCookieOptions(this.config),
      expires: new Date(expiresAt),
    });
  }
  private clear(response: Response) {
    response.clearCookie(refreshCookieName(this.config), refreshCookieOptions(this.config));
  }
  @CookieFlow('login')
  @Post('login')
  @HttpCode(200)
  @PublicEndpoint()
  @ApiBody({ schema: openApiSchema(loginSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(authResponseSchema) })
  async login(
    @Body(new ZodPipe(loginSchema)) input: Login,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input);
    this.cookie(response, result.refreshToken, result.response.sessionExpiresAt);
    return result.response;
  }
  @ApiCookieAuth('refresh')
  @CookieFlow('refresh')
  @Post('refresh')
  @HttpCode(200)
  @PublicEndpoint()
  @ApiBody({ schema: openApiSchema(emptyBodySchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(authResponseSchema) })
  async refresh(
    @Body(new ZodPipe(emptyBodySchema)) _input: Record<string, never>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.refresh(readRefreshCookie(request, this.config));
    this.cookie(response, result.refreshToken, result.response.sessionExpiresAt);
    return result.response;
  }
  @ApiCookieAuth('refresh')
  @CookieFlow('logout')
  @Post('logout')
  @HttpCode(204)
  @PublicEndpoint()
  @ApiBody({ schema: openApiSchema(emptyBodySchema, 'input') })
  @ApiNoContentResponse()
  async logout(
    @Body(new ZodPipe(emptyBodySchema)) _input: Record<string, never>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(readRefreshCookie(request, this.config));
    this.clear(response);
  }
  @Get('me')
  @IdentityEndpoint()
  @ApiBearerAuth()
  @ApiOkResponse({ schema: openApiSchema(meResponseSchema) })
  me(@CurrentPrincipal() principal: Principal) {
    return this.auth.me(principal);
  }
  @Post('context')
  @HttpCode(200)
  @IdentityEndpoint()
  @ApiBearerAuth()
  @ApiBody({ schema: openApiSchema(selectContextSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(authResponseSchema) })
  context(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodPipe(selectContextSchema)) input: { organizationId: string },
  ) {
    return this.auth.select(principal, input.organizationId);
  }
  @Post('logout-all')
  @HttpCode(204)
  @IdentityEndpoint()
  @ApiBearerAuth()
  @ApiBody({ schema: openApiSchema(emptyBodySchema, 'input') })
  @ApiNoContentResponse()
  async logoutAll(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodPipe(emptyBodySchema)) _input: Record<string, never>,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logoutAll(principal);
    this.clear(response);
  }
  @Post('change-password')
  @HttpCode(204)
  @IdentityEndpoint()
  @ApiBearerAuth()
  @ApiBody({ schema: openApiSchema(changePasswordSchema, 'input') })
  @ApiNoContentResponse()
  async changePassword(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodPipe(changePasswordSchema)) input: ChangePassword,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(principal, input);
    this.clear(response);
  }
}
