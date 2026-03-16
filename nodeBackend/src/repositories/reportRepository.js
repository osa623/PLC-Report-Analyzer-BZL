class ReportRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createReport({ companyId, filePath }) {
    const query = `
      INSERT INTO reports (company_id, file_path, workflow_state)
      VALUES ($1, $2, 'UPLOADED')
      RETURNING id, company_id, file_path, workflow_state, created_at
    `;
    const result = await this.pool.query(query, [companyId, filePath]);
    return result.rows[0];
  }

  async updateWorkflowState(reportId, state, errorMessage = null) {
    const query = `
      UPDATE reports
      SET workflow_state = $2,
          error_message = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, workflow_state, updated_at, error_message
    `;
    const result = await this.pool.query(query, [reportId, state, errorMessage]);
    return result.rows[0];
  }

  async getById(reportId) {
    const result = await this.pool.query(
      `SELECT id, company_id, file_path, workflow_state, created_at, updated_at
       FROM reports WHERE id = $1`,
      [reportId]
    );
    return result.rows[0] || null;
  }
}

module.exports = { ReportRepository };
