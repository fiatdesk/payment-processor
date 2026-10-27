export class AppError extends Error {
  statusCode: number;
  type: string;
  /** Extra fields returned in the error body (e.g. `transaction_hash`) */
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    type = 'internal_error',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    if (details) this.details = details;
    // Restore prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
