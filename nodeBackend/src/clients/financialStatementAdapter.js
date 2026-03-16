class FinancialStatementAdapter {
  normalize(payload) {
    return {
      report_id: payload.report_id,
      periods: payload.periods || [],
      items: payload.items || []
    };
  }
}

module.exports = { FinancialStatementAdapter };
