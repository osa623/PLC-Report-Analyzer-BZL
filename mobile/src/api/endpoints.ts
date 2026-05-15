export const endpoints = {
  health: '/health',
  report: (reportId: string) => `/reports/${reportId}`,
  analytics: (reportId: string) => `/pipeline/${reportId}/analytics`,
  validated: (reportId: string) => `/pipeline/${reportId}/validated`,
  errors: (reportId: string) => `/pipeline/${reportId}/errors`,
  stages: (reportId: string) => `/pipeline/${reportId}/stages`,
  documents: (reportId: string) => `/pipeline/${reportId}/documents`,
  fxLatest: '/fx/latest',
  currencyConvert: '/currency/convert',
};
