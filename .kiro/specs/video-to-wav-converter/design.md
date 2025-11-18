# Design Document - Video to WAV Converter

## Overview

O Video-to-WAV Converter é um sistema web que permite aos usuários fazer upload de arquivos de vídeo em diversos formatos e extrair o áudio em formato WAV de alta qualidade, sem perdas. O sistema utiliza FFmpeg como engine de processamento de mídia, oferecendo uma interface web simples e intuitiva para upload e download de arquivos.

A arquitetura é baseada em uma aplicação web com backend Node.js/Express e frontend em HTML/CSS/JavaScript, utilizando FFmpeg para processamento de mídia. O sistema é projetado para ser eficiente, seguro e capaz de lidar com múltiplos usuários simultaneamente.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Web Browser   │
│   (Frontend)    │
└────────┬────────┘
         │ HTTP/HTTPS
         │
┌────────▼────────┐
│  Express Server │
│   (Backend)     │
├─────────────────┤
│ • Upload API    │
│ • Convert API   │
│ • Download API  │
│ • Status API    │
└────────┬────────┘
         │
┌────────▼────────┐
│ Conversion      │
│ Service         │
├─────────────────┤
│ • FFmpeg Wrapper│
│ • Job Queue     │
│ • File Manager  │
└────────┬────────┘
         │
┌────────▼────────┐
│ File System     │
├─────────────────┤
│ • Temp Storage  │
│ • Upload Dir    │
│ • Output Dir    │
└─────────────────┘
```

### Technology Stack

- **Backend**: Node.js with Express.js
- **Media Processing**: FFmpeg (via fluent-ffmpeg library)
- **File Upload**: Multer middleware
- **Frontend**: Vanilla JavaScript with Fetch API
- **Job Queue**: Simple in-memory queue (can be upgraded to Bull/Redis for production)
- **File Storage**: Local filesystem with automatic cleanup

## Components and Interfaces

### 1. Frontend Components

#### UploadComponent
- **Responsibility**: Gerenciar interface de upload de arquivos
- **Interface**:
  ```typescript
  interface UploadComponent {
    selectFile(): void;
    uploadFile(file: File): Promise<UploadResponse>;
    displayProgress(percent: number): void;
    handleError(error: Error): void;
  }
  
  interface UploadResponse {
    jobId: string;
    filename: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
  }
  ```

#### ProgressComponent
- **Responsibility**: Exibir progresso da conversão
- **Interface**:
  ```typescript
  interface ProgressComponent {
    pollStatus(jobId: string): void;
    updateProgress(status: ConversionStatus): void;
    showCompletion(downloadUrl: string): void;
    showError(message: string): void;
  }
  
  interface ConversionStatus {
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number; // 0-100
    message?: string;
    outputFile?: string;
  }
  ```

#### DownloadComponent
- **Responsibility**: Gerenciar download do arquivo WAV
- **Interface**:
  ```typescript
  interface DownloadComponent {
    initiateDownload(jobId: string): void;
    displayDownloadButton(url: string, filename: string): void;
  }
  ```

### 2. Backend Components

#### UploadController
- **Responsibility**: Receber e validar uploads de vídeo
- **Interface**:
  ```typescript
  interface UploadController {
    handleUpload(req: Request, res: Response): Promise<void>;
    validateFile(file: MulterFile): ValidationResult;
  }
  
  interface ValidationResult {
    valid: boolean;
    error?: string;
  }
  ```

#### ConversionService
- **Responsibility**: Gerenciar fila de conversão e processar vídeos
- **Interface**:
  ```typescript
  interface ConversionService {
    queueJob(inputPath: string, jobId: string): void;
    processJob(job: ConversionJob): Promise<void>;
    getJobStatus(jobId: string): ConversionStatus;
    cancelJob(jobId: string): void;
  }
  
  interface ConversionJob {
    jobId: string;
    inputPath: string;
    outputPath: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    createdAt: Date;
  }
  ```

#### FFmpegWrapper
- **Responsibility**: Encapsular operações do FFmpeg
- **Interface**:
  ```typescript
  interface FFmpegWrapper {
    extractAudio(inputPath: string, outputPath: string, 
                 onProgress: (percent: number) => void): Promise<AudioMetadata>;
    getVideoMetadata(inputPath: string): Promise<VideoMetadata>;
    validateVideoFile(inputPath: string): Promise<boolean>;
  }
  
  interface AudioMetadata {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    duration: number;
  }
  
  interface VideoMetadata {
    hasAudio: boolean;
    hasVideo: boolean;
    duration: number;
    format: string;
    audioCodec?: string;
  }
  ```

#### FileManager
- **Responsibility**: Gerenciar arquivos temporários e limpeza
- **Interface**:
  ```typescript
  interface FileManager {
    saveUploadedFile(file: Buffer, filename: string): Promise<string>;
    getOutputPath(jobId: string, originalFilename: string): string;
    cleanupJob(jobId: string): Promise<void>;
    scheduleCleanup(jobId: string, delayMs: number): void;
    cleanupOldFiles(maxAgeMs: number): Promise<number>;
  }
  ```

#### DownloadController
- **Responsibility**: Servir arquivos WAV para download
- **Interface**:
  ```typescript
  interface DownloadController {
    handleDownload(req: Request, res: Response): Promise<void>;
    streamFile(filePath: string, res: Response): void;
  }
  ```

## Data Models

### ConversionJob
```typescript
interface ConversionJob {
  jobId: string;              // UUID único para o job
  inputPath: string;          // Caminho do arquivo de vídeo original
  outputPath: string;         // Caminho do arquivo WAV gerado
  originalFilename: string;   // Nome original do arquivo
  status: JobStatus;          // Status atual do job
  progress: number;           // Progresso 0-100
  createdAt: Date;           // Timestamp de criação
  completedAt?: Date;        // Timestamp de conclusão
  error?: string;            // Mensagem de erro se falhou
  metadata?: AudioMetadata;  // Metadados do áudio extraído
}

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
```

### AudioMetadata
```typescript
interface AudioMetadata {
  sampleRate: number;    // Taxa de amostragem (Hz): 44100, 48000, etc.
  bitDepth: number;      // Profundidade de bits: 16, 24, 32
  channels: number;      // Número de canais: 1 (mono), 2 (stereo), etc.
  duration: number;      // Duração em segundos
  codec: string;         // Codec original do áudio
  bitrate: number;       // Bitrate do áudio original
}
```

### UploadedFile
```typescript
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Valid file acceptance
*For any* valid video file with audio stream, when uploaded to the system, the system should accept the file and return a successful response with a job ID.
**Validates: Requirements 1.1**

### Property 2: Upload completion creates job
*For any* successfully uploaded video file, the system should create a conversion job with status 'queued' or 'processing'.
**Validates: Requirements 1.3**

### Property 3: Invalid format rejection
*For any* file with unsupported video format, the system should reject the upload and return an error message listing supported formats.
**Validates: Requirements 2.6**

### Property 4: Audio parameters preservation
*For any* video file with audio stream, the extracted WAV file should preserve the original sample rate and bit depth without resampling or lossy reencoding.
**Validates: Requirements 3.1**

### Property 5: PCM encoding
*For any* generated WAV file, the audio codec should be PCM (uncompressed).
**Validates: Requirements 3.2**

### Property 6: Successful conversion creates downloadable file
*For any* conversion job that completes with status 'completed', a valid WAV file should exist at the output path and be accessible for download.
**Validates: Requirements 4.1**

### Property 7: Download returns correct file
*For any* completed conversion job, requesting download should return the WAV file with correct content-type and filename.
**Validates: Requirements 4.3**

### Property 8: Output filename derivation
*For any* processed video file, the output WAV filename should be derived from the original filename with .wav extension.
**Validates: Requirements 4.5**

### Property 9: Progress monotonicity
*For any* conversion job in 'processing' status, subsequent progress updates should have progress values greater than or equal to previous values (monotonically increasing).
**Validates: Requirements 5.2**

### Property 10: Failed jobs have error messages
*For any* conversion job with status 'failed', the job should have a non-empty error message describing the failure.
**Validates: Requirements 5.4**

### Property 11: Job cancellation
*For any* conversion job in 'queued' or 'processing' status, calling cancel should change the job status to 'cancelled' and stop processing.
**Validates: Requirements 5.5**

### Property 12: File validation before processing
*For any* uploaded file, the system should validate that it contains valid video streams before creating a conversion job.
**Validates: Requirements 6.1**

### Property 13: Validation failure provides error message
*For any* file that fails validation, the system should return a specific error message describing the validation failure.
**Validates: Requirements 6.4**

### Property 14: Valid files proceed to conversion
*For any* file that passes validation, the system should automatically create and queue a conversion job.
**Validates: Requirements 6.5**

### Property 15: Concurrent job independence
*For any* set of multiple conversion jobs running simultaneously, each job should process independently without interfering with others (different input/output files, separate progress tracking).
**Validates: Requirements 7.1**

### Property 16: Non-blocking uploads
*For any* conversion job in progress, the system should accept new upload requests without blocking.
**Validates: Requirements 7.2**

### Property 17: FIFO job processing
*For any* sequence of queued jobs, when processed, they should complete in the same order they were queued (FIFO - First In, First Out).
**Validates: Requirements 7.3**

### Property 18: Temporary file cleanup
*For any* conversion job (whether completed, failed, or cancelled), all temporary files (input video and output WAV) should be removed after processing or after a defined timeout.
**Validates: Requirements 7.5**

### Property 19: Post-download cleanup
*For any* conversion job where the output file has been downloaded, both the input video and output WAV files should be removed from the server.
**Validates: Requirements 8.3**

### Property 20: Automatic old file cleanup
*For any* files that remain on the server beyond a defined maximum age without activity, the system should automatically remove them.
**Validates: Requirements 8.4**

### Property 21: Job isolation between users
*For any* two conversion jobs from different users, the jobs should have isolated file storage and one job should not be able to access or affect files from another job.
**Validates: Requirements 8.5**

## Error Handling

### Error Categories

1. **Upload Errors**
   - File too large: Return 413 status with max size information
   - Invalid file type: Return 400 status with supported formats list
   - Network interruption: Allow retry with same job ID
   - Disk space full: Return 507 status with error message

2. **Validation Errors**
   - No audio stream: Return 400 with message "Video file contains no audio stream"
   - Corrupted file: Return 400 with message "File is corrupted or unreadable"
   - Invalid video format: Return 400 with message "Unsupported video format"
   - File read error: Return 500 with generic error message

3. **Conversion Errors**
   - FFmpeg process failure: Mark job as 'failed' with FFmpeg error output
   - Unsupported codec: Return error with codec information
   - Insufficient memory: Return 500 with resource error message
   - Timeout: Cancel job after configurable timeout period

4. **Download Errors**
   - File not found: Return 404 with message "Conversion not completed or file expired"
   - File already downloaded: Return 410 with message "File has been removed after download"
   - Invalid job ID: Return 404 with message "Job not found"

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: any;          // Additional error details
    timestamp: string;      // ISO 8601 timestamp
  }
}
```

### Retry Strategy

- Upload failures: Client-side retry with exponential backoff (max 3 attempts)
- Conversion failures: No automatic retry, user must re-upload
- Download failures: Client-side retry (max 3 attempts)
- Transient errors (network, timeout): Automatic retry
- Permanent errors (invalid format, no audio): No retry, return error immediately

## Testing Strategy

### Unit Testing

The system will use **Jest** as the testing framework for unit tests. Unit tests will cover:

1. **File Validation**
   - Test specific examples of valid video formats (MP4, AVI, MOV, MKV, WebM)
   - Test edge case: video file without audio stream (should reject)
   - Test edge case: corrupted video file (should reject)
   - Test edge case: file exceeding maximum size (should reject)
   - Test specific examples of sample rate preservation (44.1kHz, 48kHz)
   - Test specific examples of bit depth preservation (16-bit, 24-bit)

2. **Job Management**
   - Test job creation with valid input
   - Test job status transitions (queued → processing → completed)
   - Test job cancellation at different stages

3. **File Operations**
   - Test file cleanup after successful conversion
   - Test file cleanup after failed conversion
   - Test automatic cleanup of old files

4. **API Endpoints**
   - Test upload endpoint with valid file
   - Test upload endpoint with invalid file
   - Test status endpoint returns correct job information
   - Test download endpoint serves correct file

### Property-Based Testing

The system will use **fast-check** as the property-based testing library for JavaScript/TypeScript. Property-based tests will verify universal properties across many randomly generated inputs.

**Configuration**: Each property-based test MUST run a minimum of 100 iterations to ensure thorough coverage of the input space.

**Tagging**: Each property-based test MUST include a comment tag in this exact format:
```typescript
// **Feature: video-to-wav-converter, Property {number}: {property_text}**
```

**Implementation**: Each correctness property listed above MUST be implemented by a SINGLE property-based test that validates the property across randomly generated inputs.

Property-based tests will cover:

1. **Audio Quality Properties**
   - Property 4: Audio parameters preservation (generate videos with various sample rates and bit depths)
   - Property 5: PCM encoding (verify all generated WAV files use PCM codec)

2. **Job Processing Properties**
   - Property 1: Valid file acceptance (generate valid video files)
   - Property 2: Upload completion creates job (verify job creation for all valid uploads)
   - Property 9: Progress monotonicity (verify progress always increases)
   - Property 10: Failed jobs have error messages (generate failure scenarios)
   - Property 11: Job cancellation (test cancellation at random processing stages)

3. **File Management Properties**
   - Property 8: Output filename derivation (generate various input filenames)
   - Property 18: Temporary file cleanup (verify cleanup for all job outcomes)
   - Property 19: Post-download cleanup (verify cleanup after downloads)
   - Property 20: Automatic old file cleanup (generate jobs with various ages)

4. **Validation Properties**
   - Property 3: Invalid format rejection (generate invalid file formats)
   - Property 12: File validation before processing (generate various file types)
   - Property 13: Validation failure provides error message (generate invalid inputs)
   - Property 14: Valid files proceed to conversion (generate valid inputs)

5. **Concurrency Properties**
   - Property 15: Concurrent job independence (generate multiple simultaneous jobs)
   - Property 16: Non-blocking uploads (test uploads during processing)
   - Property 17: FIFO job processing (generate job sequences)
   - Property 21: Job isolation between users (generate multi-user scenarios)

6. **Download Properties**
   - Property 6: Successful conversion creates downloadable file (verify file existence)
   - Property 7: Download returns correct file (verify download content)

### Integration Testing

Integration tests will verify end-to-end workflows:

1. Complete conversion flow: upload → validate → convert → download
2. Error handling flow: upload invalid file → receive error → retry with valid file
3. Concurrent users: multiple users uploading and downloading simultaneously
4. Cleanup flow: verify files are removed after download or timeout

### Test Data

- Sample video files in various formats (MP4, AVI, MOV, MKV, WebM)
- Videos with different audio configurations (mono, stereo, 5.1)
- Videos with different sample rates (44.1kHz, 48kHz, 96kHz)
- Videos with different bit depths (16-bit, 24-bit)
- Edge cases: video without audio, corrupted files, very large files

## Implementation Notes

### FFmpeg Command for Lossless Extraction

The system will use the following FFmpeg command pattern for lossless audio extraction:

```bash
ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 48000 output.wav
```

Parameters:
- `-i input.mp4`: Input video file
- `-vn`: Disable video recording (audio only)
- `-acodec pcm_s16le`: Use PCM signed 16-bit little-endian codec (lossless)
- `-ar 48000`: Sample rate (will be detected from source and preserved)
- For 24-bit: use `pcm_s24le` instead of `pcm_s16le`

The actual implementation will detect the source audio parameters and preserve them automatically.

### File Storage Structure

```
uploads/
  ├── {jobId}/
  │   ├── input.{ext}      # Original video file
  │   └── output.wav       # Converted WAV file
```

Each job gets its own directory for isolation and easy cleanup.

### Configuration

```typescript
interface SystemConfig {
  maxFileSize: number;           // Maximum upload size in bytes (default: 500MB)
  maxConcurrentJobs: number;     // Maximum simultaneous conversions (default: 3)
  fileRetentionTime: number;     // Time to keep files after completion in ms (default: 1 hour)
  cleanupInterval: number;       // Interval for automatic cleanup in ms (default: 15 minutes)
  conversionTimeout: number;     // Maximum time for conversion in ms (default: 30 minutes)
  supportedFormats: string[];    // List of supported video formats
}
```

### Security Considerations

1. **File Upload Security**
   - Validate file signatures (magic numbers) not just extensions
   - Limit file size to prevent DoS attacks
   - Sanitize filenames to prevent path traversal
   - Use unique job IDs (UUID) to prevent guessing

2. **Resource Management**
   - Limit concurrent conversions to prevent resource exhaustion
   - Implement timeout for long-running conversions
   - Monitor disk space and reject uploads if low

3. **Data Privacy**
   - Automatic file deletion after download
   - No logging of file contents
   - Isolated storage per job
   - HTTPS for all communications

### Performance Optimization

1. **Streaming**: Use streaming for file uploads and downloads to handle large files efficiently
2. **Queue Management**: Process jobs in background to keep API responsive
3. **Progress Updates**: Use FFmpeg progress callback for real-time updates
4. **Cleanup**: Run cleanup in background to avoid blocking operations
5. **Caching**: Cache FFmpeg metadata queries for repeated operations

## API Specification

### POST /api/upload
Upload a video file for conversion.

**Request**: multipart/form-data with 'video' field
**Response**:
```json
{
  "jobId": "uuid",
  "filename": "original.mp4",
  "status": "queued"
}
```

### GET /api/status/:jobId
Get conversion status.

**Response**:
```json
{
  "jobId": "uuid",
  "status": "processing",
  "progress": 45,
  "message": "Converting audio..."
}
```

### GET /api/download/:jobId
Download converted WAV file.

**Response**: Binary WAV file with appropriate headers

### POST /api/cancel/:jobId
Cancel a conversion job.

**Response**:
```json
{
  "jobId": "uuid",
  "status": "cancelled"
}
```

### DELETE /api/cleanup/:jobId
Manually trigger cleanup for a job.

**Response**:
```json
{
  "jobId": "uuid",
  "cleaned": true
}
```
