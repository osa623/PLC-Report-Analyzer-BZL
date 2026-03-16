class ApplicationError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = "ApplicationError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

module.exports = { ApplicationError };
