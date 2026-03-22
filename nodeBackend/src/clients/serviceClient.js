const axios = require("axios");
const { ApplicationError } = require("../utils/errors");

class ServiceClient {
  constructor({ serviceRegistry, logger, timeoutMs = 120000 }) {
    this.serviceRegistry = serviceRegistry;
    this.logger = logger;
    this.defaultTimeoutMs = timeoutMs;
    this.maxAttempts = 3;
    this.retryDelayMs = 1500;
    this.http = axios.create({ timeout: timeoutMs });
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async post(serviceName, endpoint, payload, options = {}) {
    const baseUrl = this.serviceRegistry[serviceName];
    if (!baseUrl) {
      throw new ApplicationError(`Service not registered: ${serviceName}`, 500);
    }

    const url = `${baseUrl}${endpoint}`;
    const timeout = Number(options.timeoutMs || this.defaultTimeoutMs);

    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.http.post(url, payload, { timeout });
        return response.data;
      } catch (error) {
        lastError = error;
        const isRetriable = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(error.code);
        if (isRetriable && attempt < this.maxAttempts) {
          await this.sleep(this.retryDelayMs);
          continue;
        }
        break;
      }
    }

    this.logger.error(
      {
        serviceName,
        endpoint,
        url,
        timeout,
        code: lastError?.code,
        error: lastError?.message,
        response: lastError?.response?.data
      },
      "Service invocation failed"
    );
    throw new ApplicationError(`Failed to call ${serviceName}`, 502, {
      serviceName,
      endpoint
    });
  }
}

module.exports = { ServiceClient };
