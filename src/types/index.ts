/**
 * Core data models and types for Video-to-WAV Converter
 * Requirements: 1.1, 1.3, 3.1, 5.2, 5.4
 */

/**
 * Job status enumeration
 */
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Conversion job data model
 * Represents a video-to-WAV conversion job throughout its lifecycle
 */
export interface ConversionJob {
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

/**
 * Audio metadata extracted from video file
 * Contains information about the audio stream
 */
export interface AudioMetadata {
  sampleRate: number;    // Taxa de amostragem (Hz): 44100, 48000, etc.
  bitDepth: number;      // Profundidade de bits: 16, 24, 32
  channels: number;      // Número de canais: 1 (mono), 2 (stereo), etc.
  duration: number;      // Duração em segundos
  codec: string;         // Codec original do áudio
  bitrate: number;       // Bitrate do áudio original
}

/**
 * Video metadata extracted from video file
 * Contains information about video and audio streams
 */
export interface VideoMetadata {
  hasAudio: boolean;     // Indica se o vídeo contém stream de áudio
  hasVideo: boolean;     // Indica se o arquivo contém stream de vídeo
  duration: number;      // Duração total em segundos
  format: string;        // Formato do container (mp4, avi, mov, etc.)
  audioCodec?: string;   // Codec do áudio (se presente)
}

/**
 * Uploaded file information from multer
 */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

/**
 * API Request Types
 */

/**
 * Response for upload endpoint
 */
export interface UploadResponse {
  jobId: string;
  filename: string;
  status: JobStatus;
}

/**
 * Response for status endpoint
 */
export interface ConversionStatus {
  jobId: string;
  status: JobStatus;
  progress: number;       // 0-100
  message?: string;
  outputFile?: string;
}

/**
 * Validation result for file validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: any;          // Additional error details
    timestamp: string;      // ISO 8601 timestamp
  };
}

/**
 * System configuration interface
 */
export interface SystemConfig {
  maxFileSize: number;           // Maximum upload size in bytes (default: 500MB)
  maxConcurrentJobs: number;     // Maximum simultaneous conversions (default: 3)
  fileRetentionTime: number;     // Time to keep files after completion in ms (default: 1 hour)
  cleanupInterval: number;       // Interval for automatic cleanup in ms (default: 15 minutes)
  conversionTimeout: number;     // Maximum time for conversion in ms (default: 30 minutes)
  supportedFormats: string[];    // List of supported video formats
}
