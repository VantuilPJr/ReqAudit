export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: isForm || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body:
      body === undefined
        ? undefined
        : isForm
          ? body
          : JSON.stringify(body),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      'Não foi possível acessar o servidor. Verifique se o ReqAudit está em execução.',
      response.status,
    );
  }

  if (!response.ok) {
    const rawMessage =
      typeof payload === 'object' && payload && 'error' in payload
        ? payload.error
        : null;
    const message =
      typeof rawMessage === 'string' ? rawMessage : 'Falha na operação.';
    throw new ApiError(message, response.status);
  }

  return payload as T;
}
