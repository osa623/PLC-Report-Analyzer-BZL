/** ── Sample data for the Extraction / Processing module ── */

export type PipelineStage = {
  id: string;
  title: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
  completedAt?: string;
  progress?: number;
};

export type ProcessingThread = {
  id: string;
  filename: string;
  fileSize: string;
  pages: number;
  uploadedAt: string;
  uploadedBy: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  duration?: string;
  pagesProcessed: number;
  tablesExtracted: number;
  dataPoints: number;
  issues: number;
  confidenceScore: number;
  validationAccuracy: number;
  extractedSections: string[];
  detectedYears: number[];
  stages: PipelineStage[];
  currentStage?: string;
};

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  status: 'success' | 'processing' | 'warning' | 'failed';
  timestamp: string;
};

export const samplePipelineStages: PipelineStage[] = [
  { id: '1', title: 'Upload',             status: 'completed', completedAt: '09:34 AM' },
  { id: '2', title: 'Parsing',            status: 'completed', completedAt: '09:35 AM' },
  { id: '3', title: 'Structure',          status: 'completed', completedAt: '09:36 AM' },
  { id: '4', title: 'Extraction',         status: 'completed', completedAt: '09:38 AM' },
  { id: '5', title: 'Aggregation',        status: 'running',   progress: 72 },
  { id: '6', title: 'Validation',         status: 'pending' },
  { id: '7', title: 'Analytics',          status: 'pending' },
  { id: '8', title: 'Report Generation',  status: 'pending' },
];

export const sampleThreads: ProcessingThread[] = [
  {
    id: 'rpt-001',
    filename: 'TechCorp Annual Report 2025.pdf',
    fileSize: '2.4 MB',
    pages: 256,
    uploadedAt: 'May 16, 2025 09:41 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'completed',
    progress: 100,
    duration: '33.5s',
    pagesProcessed: 256,
    tablesExtracted: 42,
    dataPoints: 1248,
    issues: 0,
    confidenceScore: 97.8,
    validationAccuracy: 99.2,
    extractedSections: ['Balance Sheet', 'Income Statement', 'Cash Flow', 'Notes', 'Auditor Report'],
    detectedYears: [2023, 2024, 2025],
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:41 AM' },
      { id: '2', title: 'Parsing',           status: 'completed', completedAt: '09:41 AM' },
      { id: '3', title: 'Structure',         status: 'completed', completedAt: '09:41 AM' },
      { id: '4', title: 'Extraction',        status: 'completed', completedAt: '09:41 AM' },
      { id: '5', title: 'Aggregation',       status: 'completed', completedAt: '09:41 AM' },
      { id: '6', title: 'Validation',        status: 'completed', completedAt: '09:41 AM' },
      { id: '7', title: 'Analytics',         status: 'completed', completedAt: '09:41 AM' },
      { id: '8', title: 'Report Generation', status: 'completed', completedAt: '09:41 AM' },
    ],
  },
  {
    id: 'rpt-002',
    filename: 'TechCorp Annual Report 2024.pdf',
    fileSize: '2.1 MB',
    pages: 238,
    uploadedAt: 'May 16, 2025 09:39 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'running',
    progress: 75,
    pagesProcessed: 178,
    tablesExtracted: 31,
    dataPoints: 892,
    issues: 1,
    confidenceScore: 94.2,
    validationAccuracy: 96.8,
    extractedSections: ['Balance Sheet', 'Income Statement', 'Cash Flow'],
    detectedYears: [2022, 2023, 2024],
    currentStage: 'Aggregation',
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:39 AM' },
      { id: '2', title: 'Parsing',           status: 'completed', completedAt: '09:39 AM' },
      { id: '3', title: 'Structure',         status: 'completed', completedAt: '09:39 AM' },
      { id: '4', title: 'Extraction',        status: 'completed', completedAt: '09:40 AM' },
      { id: '5', title: 'Aggregation',       status: 'running',   progress: 75 },
      { id: '6', title: 'Validation',        status: 'pending' },
      { id: '7', title: 'Analytics',         status: 'pending' },
      { id: '8', title: 'Report Generation', status: 'pending' },
    ],
  },
  {
    id: 'rpt-003',
    filename: 'TechCorp Annual Report 2023.pdf',
    fileSize: '1.8 MB',
    pages: 214,
    uploadedAt: 'May 16, 2025 09:37 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'completed',
    progress: 100,
    duration: '214.3s',
    pagesProcessed: 214,
    tablesExtracted: 38,
    dataPoints: 1102,
    issues: 0,
    confidenceScore: 96.5,
    validationAccuracy: 98.7,
    extractedSections: ['Balance Sheet', 'Income Statement', 'Cash Flow', 'Notes'],
    detectedYears: [2021, 2022, 2023],
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:37 AM' },
      { id: '2', title: 'Parsing',           status: 'completed', completedAt: '09:37 AM' },
      { id: '3', title: 'Structure',         status: 'completed', completedAt: '09:37 AM' },
      { id: '4', title: 'Extraction',        status: 'completed', completedAt: '09:37 AM' },
      { id: '5', title: 'Aggregation',       status: 'completed', completedAt: '09:37 AM' },
      { id: '6', title: 'Validation',        status: 'completed', completedAt: '09:37 AM' },
      { id: '7', title: 'Analytics',         status: 'completed', completedAt: '09:37 AM' },
      { id: '8', title: 'Report Generation', status: 'completed', completedAt: '09:37 AM' },
    ],
  },
  {
    id: 'rpt-004',
    filename: 'TechCorp Annual Report 2022.pdf',
    fileSize: '1.6 MB',
    pages: 198,
    uploadedAt: 'May 16, 2025 09:34 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'completed',
    progress: 100,
    duration: '218.4s',
    pagesProcessed: 198,
    tablesExtracted: 35,
    dataPoints: 984,
    issues: 0,
    confidenceScore: 95.1,
    validationAccuracy: 97.9,
    extractedSections: ['Balance Sheet', 'Income Statement', 'Cash Flow', 'Notes'],
    detectedYears: [2020, 2021, 2022],
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:34 AM' },
      { id: '2', title: 'Parsing',           status: 'completed', completedAt: '09:34 AM' },
      { id: '3', title: 'Structure',         status: 'completed', completedAt: '09:35 AM' },
      { id: '4', title: 'Extraction',        status: 'completed', completedAt: '09:35 AM' },
      { id: '5', title: 'Aggregation',       status: 'completed', completedAt: '09:35 AM' },
      { id: '6', title: 'Validation',        status: 'completed', completedAt: '09:36 AM' },
      { id: '7', title: 'Analytics',         status: 'completed', completedAt: '09:36 AM' },
      { id: '8', title: 'Report Generation', status: 'completed', completedAt: '09:36 AM' },
    ],
  },
  {
    id: 'rpt-005',
    filename: 'GlobalFin Holdings 2025.pdf',
    fileSize: '3.1 MB',
    pages: 312,
    uploadedAt: 'May 16, 2025 09:32 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'failed',
    progress: 45,
    pagesProcessed: 140,
    tablesExtracted: 12,
    dataPoints: 328,
    issues: 3,
    confidenceScore: 62.4,
    validationAccuracy: 71.2,
    extractedSections: ['Balance Sheet'],
    detectedYears: [2024, 2025],
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:32 AM' },
      { id: '2', title: 'Parsing',           status: 'completed', completedAt: '09:32 AM' },
      { id: '3', title: 'Structure',         status: 'completed', completedAt: '09:33 AM' },
      { id: '4', title: 'Extraction',        status: 'failed' },
      { id: '5', title: 'Aggregation',       status: 'pending' },
      { id: '6', title: 'Validation',        status: 'pending' },
      { id: '7', title: 'Analytics',         status: 'pending' },
      { id: '8', title: 'Report Generation', status: 'pending' },
    ],
  },
  {
    id: 'rpt-006',
    filename: 'MegaCorp Industries 2025.pdf',
    fileSize: '2.7 MB',
    pages: 276,
    uploadedAt: 'May 16, 2025 09:30 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'completed',
    progress: 100,
    duration: '156.2s',
    pagesProcessed: 276,
    tablesExtracted: 48,
    dataPoints: 1456,
    issues: 0,
    confidenceScore: 98.1,
    validationAccuracy: 99.5,
    extractedSections: ['Balance Sheet', 'Income Statement', 'Cash Flow', 'Notes', 'Auditor Report', 'Board Report'],
    detectedYears: [2023, 2024, 2025],
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:30 AM' },
      { id: '2', title: 'Parsing',           status: 'completed', completedAt: '09:30 AM' },
      { id: '3', title: 'Structure',         status: 'completed', completedAt: '09:31 AM' },
      { id: '4', title: 'Extraction',        status: 'completed', completedAt: '09:31 AM' },
      { id: '5', title: 'Aggregation',       status: 'completed', completedAt: '09:32 AM' },
      { id: '6', title: 'Validation',        status: 'completed', completedAt: '09:32 AM' },
      { id: '7', title: 'Analytics',         status: 'completed', completedAt: '09:33 AM' },
      { id: '8', title: 'Report Generation', status: 'completed', completedAt: '09:33 AM' },
    ],
  },
  {
    id: 'rpt-007',
    filename: 'Apex Financial Group 2024.pdf',
    fileSize: '1.9 MB',
    pages: 224,
    uploadedAt: 'May 16, 2025 09:28 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'completed',
    progress: 100,
    duration: '189.7s',
    pagesProcessed: 224,
    tablesExtracted: 36,
    dataPoints: 1078,
    issues: 1,
    confidenceScore: 93.6,
    validationAccuracy: 97.1,
    extractedSections: ['Balance Sheet', 'Income Statement', 'Cash Flow', 'Notes'],
    detectedYears: [2022, 2023, 2024],
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:28 AM' },
      { id: '2', title: 'Parsing',           status: 'completed', completedAt: '09:28 AM' },
      { id: '3', title: 'Structure',         status: 'completed', completedAt: '09:29 AM' },
      { id: '4', title: 'Extraction',        status: 'completed', completedAt: '09:29 AM' },
      { id: '5', title: 'Aggregation',       status: 'completed', completedAt: '09:30 AM' },
      { id: '6', title: 'Validation',        status: 'completed', completedAt: '09:30 AM' },
      { id: '7', title: 'Analytics',         status: 'completed', completedAt: '09:31 AM' },
      { id: '8', title: 'Report Generation', status: 'completed', completedAt: '09:31 AM' },
    ],
  },
  {
    id: 'rpt-008',
    filename: 'Nexus Corp Annual 2025.pdf',
    fileSize: '2.2 MB',
    pages: 242,
    uploadedAt: 'May 16, 2025 09:26 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'completed',
    progress: 100,
    duration: '201.3s',
    pagesProcessed: 242,
    tablesExtracted: 40,
    dataPoints: 1189,
    issues: 0,
    confidenceScore: 96.9,
    validationAccuracy: 98.4,
    extractedSections: ['Balance Sheet', 'Income Statement', 'Cash Flow', 'Notes', 'Board Report'],
    detectedYears: [2023, 2024, 2025],
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:26 AM' },
      { id: '2', title: 'Parsing',           status: 'completed', completedAt: '09:26 AM' },
      { id: '3', title: 'Structure',         status: 'completed', completedAt: '09:27 AM' },
      { id: '4', title: 'Extraction',        status: 'completed', completedAt: '09:27 AM' },
      { id: '5', title: 'Aggregation',       status: 'completed', completedAt: '09:28 AM' },
      { id: '6', title: 'Validation',        status: 'completed', completedAt: '09:28 AM' },
      { id: '7', title: 'Analytics',         status: 'completed', completedAt: '09:29 AM' },
      { id: '8', title: 'Report Generation', status: 'completed', completedAt: '09:29 AM' },
    ],
  },
  {
    id: 'rpt-009',
    filename: 'Quantum Holdings 2025.pdf',
    fileSize: '2.8 MB',
    pages: 290,
    uploadedAt: 'May 16, 2025 09:24 AM',
    uploadedBy: 'Arjun Kumar',
    status: 'queued',
    progress: 0,
    pagesProcessed: 0,
    tablesExtracted: 0,
    dataPoints: 0,
    issues: 0,
    confidenceScore: 0,
    validationAccuracy: 0,
    extractedSections: [],
    detectedYears: [],
    stages: [
      { id: '1', title: 'Upload',            status: 'completed', completedAt: '09:24 AM' },
      { id: '2', title: 'Parsing',           status: 'pending' },
      { id: '3', title: 'Structure',         status: 'pending' },
      { id: '4', title: 'Extraction',        status: 'pending' },
      { id: '5', title: 'Aggregation',       status: 'pending' },
      { id: '6', title: 'Validation',        status: 'pending' },
      { id: '7', title: 'Analytics',         status: 'pending' },
      { id: '8', title: 'Report Generation', status: 'pending' },
    ],
  },
];

export const sampleActivities: ActivityItem[] = [
  {
    id: 'act-1',
    title: 'Annual Report 2025 – TechCorp',
    description: 'Extraction completed successfully',
    status: 'success',
    timestamp: '2m ago',
  },
  {
    id: 'act-2',
    title: 'Annual Report 2024 – TechCorp',
    description: 'Processing in progress',
    status: 'processing',
    timestamp: '5m ago',
  },
  {
    id: 'act-3',
    title: 'GlobalFin Holdings 2025',
    description: 'Extraction failed – OCR error on page 141',
    status: 'failed',
    timestamp: '12m ago',
  },
  {
    id: 'act-4',
    title: 'MegaCorp Industries 2025',
    description: 'Completed with 0 issues',
    status: 'success',
    timestamp: '18m ago',
  },
  {
    id: 'act-5',
    title: 'Apex Financial Group 2024',
    description: '1 warning — low-confidence table on page 87',
    status: 'warning',
    timestamp: '25m ago',
  },
];
