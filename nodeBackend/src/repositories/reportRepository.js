class ReportRepository {
  constructor(pool) {
    this.pool = pool;
    this._hasPdfPathColumn = null;
  }

  async hasPdfPathColumn() {
    if (this._hasPdfPathColumn !== null) {
      return this._hasPdfPathColumn;
    }

    const result = await this.pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'reports'
           AND column_name = 'pdf_path'
       ) AS exists`
    );

    this._hasPdfPathColumn = !!result.rows[0]?.exists;
    return this._hasPdfPathColumn;
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

  async updateReportPdfPath(reportId, pdfPath) {
    const hasPdfPath = await this.hasPdfPathColumn();
    if (!hasPdfPath) {
      return { id: reportId, pdf_path: null };
    }

    const query = `
      UPDATE reports
      SET pdf_path = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, pdf_path
    `;
    const result = await this.pool.query(query, [reportId, pdfPath]);
    return result.rows[0];
  }

  async getById(reportId) {
    const hasPdfPath = await this.hasPdfPathColumn();
    const pdfPathSelect = hasPdfPath ? "r.pdf_path" : "NULL::text AS pdf_path";

    const result = await this.pool.query(
      `SELECT r.id, r.company_id, r.file_path, ${pdfPathSelect}, r.workflow_state, r.created_at, r.updated_at,
              c.symbol, c.name, c.sector
       FROM reports r
       JOIN companies c ON c.id = r.company_id
       WHERE r.id = $1`,
      [reportId]
    );
    return result.rows[0] || null;
  }
}

module.exports = { ReportRepository };
