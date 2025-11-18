# Video to WAV Converter

Web application to convert video files to WAV audio format with lossless quality.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- FFmpeg installed and available in system PATH

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Development

Run in development mode:
```bash
npm run dev
```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Project Structure

```
.
├── src/
│   ├── controllers/    # API endpoint handlers
│   ├── services/       # Business logic and FFmpeg wrapper
│   ├── utils/          # Utility functions
│   └── index.ts        # Application entry point
├── public/             # Frontend static files
├── dist/               # Compiled TypeScript output
└── uploads/            # Temporary file storage (created at runtime)
```

## Configuration

The application can be configured through environment variables or the config file.

## API Endpoints

- `POST /api/upload` - Upload video file for conversion
- `GET /api/status/:jobId` - Get conversion status
- `GET /api/download/:jobId` - Download converted WAV file
- `POST /api/cancel/:jobId` - Cancel conversion job
- `DELETE /api/cleanup/:jobId` - Manually cleanup job files

## License

ISC
