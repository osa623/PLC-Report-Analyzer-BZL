const { ApplicationError } = require("../utils/errors");

function errorHandler(logger) {
  return (err, req, res, _next) => {
    const statusCode = err instanceof ApplicationError ? err.statusCode : 500;

    logger.error(
      {
        error: err.message,
        stack: err.stack,
        statusCode,
        path: req.path,
        requestId: req.id,
        details: err.details
      },
      "Request failed"
    );

    res.status(statusCode).json({
      error: err.message,
      details: err.details,
      requestId: req.id
    });
  };
}

module.exports = { errorHandler };
