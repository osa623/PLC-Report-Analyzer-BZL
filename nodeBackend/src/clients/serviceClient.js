const axios = require("axios");
const { ApplicationError } = require("../utils/errors");

class ServiceClient {
  constructor({ serviceRegistry, logger, timeoutMs = 120000 }) {
    this.serviceRegistry = serviceRegistry;
    this.logger = logger;
    this.http = axios.create({ timeout: timeoutMs });
  }

  async post(serviceName, endpoint, payload) {
    const baseUrl = this.serviceRegistry[serviceName];
    if (!baseUrl) {
      throw new ApplicationError(`Service not registered: ${serviceName}`, 500);
    }

    const url = `${baseUrl}${endpoint}`;

    try {
      const response = await this.http.post(url, payload);
      return response.data;
    } catch (error) {
      this.logger.error(
        {
          serviceName,
          endpoint,
          url,
          error: error.message,
          response: error.response?.data
        },
        "Service invocation failed"
      );
      throw new ApplicationError(`Failed to call ${serviceName}`, 502, {
        serviceName,
        endpoint
      });
    }
  }
}

module.exports = { ServiceClient };
