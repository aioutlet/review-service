class ErrorResponse extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode; // Add for test compatibility
    this.code = code;
  }
}

export default ErrorResponse;
