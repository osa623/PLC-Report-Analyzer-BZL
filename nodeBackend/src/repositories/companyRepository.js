class CompanyRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async upsertCompany({ symbol, name, sector }) {
    const result = await this.pool.query(
      `
      INSERT INTO companies (symbol, name, sector)
      VALUES ($1, $2, $3)
      ON CONFLICT (symbol)
      DO UPDATE SET name = EXCLUDED.name, sector = EXCLUDED.sector, updated_at = NOW()
      RETURNING id, symbol, name, sector
      `,
      [symbol, name, sector]
    );

    return result.rows[0];
  }
}

module.exports = { CompanyRepository };
