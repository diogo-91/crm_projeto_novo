import type { z } from 'zod';
import { problemResponseSchema } from '@crm/contracts';
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super('API request failed');
    this.name = 'ApiError';
  }
}
export function errorMessage(error: unknown, login = false): string {
  if (!(error instanceof ApiError)) return 'Não foi possível concluir a operação. Tente novamente.';
  if (error.code === 'UNSUPPORTED_BROWSER')
    return 'Use um navegador atualizado em uma conexão segura para entrar.';
  if (error.status === 0)
    return 'Não foi possível conectar. Verifique sua conexão e tente novamente.';
  if (error.status === 401)
    return login ? 'Credenciais inválidas.' : 'Sua sessão expirou. Entre novamente.';
  if (error.status === 403) return 'Você não tem permissão para esta ação.';
  if (error.status === 429) return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
  return 'O serviço está indisponível no momento. Tente novamente em instantes.';
}
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly transport: typeof fetch = fetch,
  ) {}
  async send(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Request-Id', crypto.randomUUID());
    let response: Response;
    try {
      const transport = this.transport;
      response = await transport(`${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        headers,
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new ApiError(0, 'NETWORK');
    }
    if (!response.ok) {
      const text = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
      const parsed = problemResponseSchema.safeParse(body);
      throw new ApiError(
        response.status,
        parsed.success ? parsed.data.code : 'HTTP_ERROR',
        parsed.success ? parsed.data.requestId : undefined,
      );
    }
    if (response.status === 204) return undefined;
    const text = await response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ApiError(502, 'INVALID_RESPONSE');
    }
  }
  async parsed<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
    init: RequestInit = {},
  ): Promise<z.output<Schema>> {
    const result = schema.safeParse(await this.send(path, init));
    if (!result.success) throw new ApiError(502, 'INVALID_RESPONSE');
    return result.data;
  }
}
