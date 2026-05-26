# FD Extractor - Admin Panel

Professional admin panel frontend for Financial Data Extractor built with React and Tailwind CSS.

## Features

- **Dashboard View**: Browse PDFs organized by categories
- **Category Grouping**: PDFs automatically grouped and displayed by category
- **Statement Extraction**: Extract three financial statements from selected PDFs
- **Statement Selection**: Review and select one or more extracted statements
- **Black & White Theme**: Clean, professional, minimal design
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **React 18**: Modern UI library
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **Axios**: HTTP client for API calls

## Getting Started

### Prerequisites

- Node.js 16+ installed
- Backend API running (default: `http://localhost:5000`)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` folder.

## Project Structure

```
fdextractor/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── Header.jsx
│   │   ├── Loader.jsx
│   │   ├── ErrorMessage.jsx
│   │   ├── PDFCard.jsx
│   │   ├── CategorySection.jsx
│   │   └── StatementCard.jsx
│   ├── pages/            # Page components
│   │   ├── Dashboard.jsx
│   │   └── PDFDetail.jsx
│   ├── services/         # API services
│   │   └── api.js
│   ├── App.jsx           # Main app component
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## API Integration

The frontend expects the following API endpoints:

### GET `/api/pdfs/by-category`
Returns PDFs grouped by category:
```json
{
  "Banks": [
    {
      "id": "pdf-1",
      "name": "Annual Report 2023.pdf",
      "company": "ABC Bank",
      "year": "2023",
      "category": "Banks",
      "pages": 150
    }
  ]
}
```

### POST `/api/pdfs/:pdfId/extract`
Extracts three statements from a PDF:
```json
{
  "pdf": {
    "id": "pdf-1",
    "name": "Annual Report 2023.pdf"
  },
  "statements": [
    {
      "type": "income",
      "data": { /* statement data */ },
      "confidence": 0.95,
      "pages": "45-47"
    },
    {
      "type": "balance",
      "data": { /* statement data */ },
      "confidence": 0.92,
      "pages": "48-50"
    },
    {
      "type": "cashflow",
      "data": { /* statement data */ },
      "confidence": 0.88,
      "pages": "51-53"
    }
  ]
}
```

### POST `/api/pdfs/:pdfId/submit`
Submits selected statements:
```json
{
  "selectedStatements": [
    { "type": "income", "data": { /* ... */ } },
    { "type": "balance", "data": { /* ... */ } }
  ]
}
```

## Customization

### Colors

Modify the color scheme in [tailwind.config.js](tailwind.config.js):

```javascript
theme: {
  extend: {
    colors: {
      primary: '#000000',
      secondary: '#ffffff',
      // Add custom colors here
    }
  }
}
```

### API Base URL

Update the API base URL in [vite.config.js](vite.config.js):

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://your-backend-url',
      changeOrigin: true,
    }
  }
}
```

## License

MIT
