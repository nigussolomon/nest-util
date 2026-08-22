/** Standardized error response shape returned to clients. */
export interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  statusCode: number;
  details: Record<string, unknown> | null;
  timestamp: string;
  path: string;
}

/** The `errorKey` payload carried on a thrown/keyed exception's response object. */
export interface KeyedExceptionResponse {
  errorKey: string;
  params?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  message: string;
}
