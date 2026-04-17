class AppError extends Error {
  public statusCode: number;
  public type?: string;

  constructor(
    statusCode: number,
    message: string,
    type?: string,

    stack = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    if (type) {
      this.type = type;
    }

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
