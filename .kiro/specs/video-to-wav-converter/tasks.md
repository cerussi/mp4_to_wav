# Implementation Plan

- [x] 1. Set up project structure and dependencies





  - Create Node.js project with package.json
  - Install core dependencies: express, multer, fluent-ffmpeg, uuid
  - Install dev dependencies: jest, fast-check, @types/node, typescript
  - Create directory structure: src/, src/controllers/, src/services/, src/utils/, public/
  - Set up TypeScript configuration
  - Configure Jest for testing
  - _Requirements: All_

- [x] 2. Implement core data models and types



  - Create TypeScript interfaces for ConversionJob, AudioMetadata, VideoMetadata
  - Create TypeScript interfaces for API request/response types
  - Create JobStatus type and error response types
  - _Requirements: 1.1, 1.3, 3.1, 5.2, 5.4_

- [x] 3. Implement FFmpegWrapper service





  - Create FFmpegWrapper class with fluent-ffmpeg integration
  - Implement getVideoMetadata() method to extract video information
  - Implement validateVideoFile() method to check if file has valid video streams
  - Implement extractAudio() method with progress callback for lossless WAV extraction
  - Detect and preserve original sample rate and bit depth
  - Use PCM codec for WAV output
  - _Requirements: 3.1, 3.2, 6.1_

- [x] 3.1 Write property test for audio parameters preservation


  - **Property 4: Audio parameters preservation**
  - **Validates: Requirements 3.1**

- [x] 3.2 Write property test for PCM encoding


  - **Property 5: PCM encoding**
  - **Validates: Requirements 3.2**

- [x] 3.3 Write unit tests for FFmpegWrapper


  - Test metadata extraction with sample video files (MP4, AVI, MOV, MKV, WebM)
  - Test validation with video without audio stream (edge case)
  - Test validation with corrupted file (edge case)
  - Test sample rate preservation (44.1kHz, 48kHz examples)
  - Test bit depth preservation (16-bit, 24-bit examples)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4, 3.5, 3.6, 6.2, 6.3_

- [-] 4. Implement FileManager service



  - Create FileManager class for file operations
  - Implement saveUploadedFile() to store uploaded videos with unique job directories
  - Implement getOutputPath() to generate output WAV file paths
  - Implement cleanupJob() to remove job directory and files
  - Implement scheduleCleanup() for delayed cleanup
  - Implement cleanupOldFiles() to remove files older than retention time
  - _Requirements: 7.5, 8.2, 8.3, 8.4_

- [-] 4.1 Write property test for temporary file cleanup

  - **Property 18: Temporary file cleanup**
  - **Validates: Requirements 7.5**

- [ ] 4.2 Write property test for post-download cleanup
  - **Property 19: Post-download cleanup**
  - **Validates: Requirements 8.3**

- [ ] 4.3 Write property test for automatic old file cleanup
  - **Property 20: Automatic old file cleanup**
  - **Validates: Requirements 8.4**

- [ ] 4.4 Write unit tests for FileManager
  - Test file saving and path generation
  - Test cleanup after successful conversion
  - Test cleanup after failed conversion
  - _Requirements: 7.5, 8.3_

- [ ] 5. Implement ConversionService with job queue
  - Create ConversionService class with in-memory job storage
  - Implement queueJob() to add jobs to processing queue
  - Implement processJob() to handle conversion with FFmpegWrapper
  - Implement getJobStatus() to retrieve job information
  - Implement cancelJob() to stop processing
  - Implement FIFO queue processing with concurrency limit
  - Track job progress and update status
  - Handle errors and set job status to 'failed' with error messages
  - _Requirements: 1.3, 5.2, 5.4, 5.5, 7.1, 7.2, 7.3_

- [ ] 5.1 Write property test for upload completion creates job
  - **Property 2: Upload completion creates job**
  - **Validates: Requirements 1.3**

- [ ] 5.2 Write property test for progress monotonicity
  - **Property 9: Progress monotonicity**
  - **Validates: Requirements 5.2**

- [ ] 5.3 Write property test for failed jobs have error messages
  - **Property 10: Failed jobs have error messages**
  - **Validates: Requirements 5.4**

- [ ] 5.4 Write property test for job cancellation
  - **Property 11: Job cancellation**
  - **Validates: Requirements 5.5**

- [ ] 5.5 Write property test for concurrent job independence
  - **Property 15: Concurrent job independence**
  - **Validates: Requirements 7.1**

- [ ] 5.6 Write property test for non-blocking uploads
  - **Property 16: Non-blocking uploads**
  - **Validates: Requirements 7.2**

- [ ] 5.7 Write property test for FIFO job processing
  - **Property 17: FIFO job processing**
  - **Validates: Requirements 7.3**

- [ ] 5.8 Write unit tests for ConversionService
  - Test job creation and queueing
  - Test job status transitions
  - Test job cancellation at different stages
  - _Requirements: 1.3, 5.5_

- [ ] 6. Implement UploadController
  - Create UploadController with multer configuration
  - Configure multer for file size limits and storage
  - Implement handleUpload() endpoint handler
  - Implement validateFile() to check file type and size
  - Validate video file has audio stream using FFmpegWrapper
  - Reject files exceeding maximum size with appropriate error
  - Reject files without audio stream with descriptive error
  - Reject corrupted files with error message
  - Create conversion job for valid files
  - Return job ID and status in response
  - _Requirements: 1.1, 1.3, 1.4, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6.1 Write property test for valid file acceptance
  - **Property 1: Valid file acceptance**
  - **Validates: Requirements 1.1**

- [ ] 6.2 Write property test for invalid format rejection
  - **Property 3: Invalid format rejection**
  - **Validates: Requirements 2.6**

- [ ] 6.3 Write property test for file validation before processing
  - **Property 12: File validation before processing**
  - **Validates: Requirements 6.1**

- [ ] 6.4 Write property test for validation failure provides error message
  - **Property 13: Validation failure provides error message**
  - **Validates: Requirements 6.4**

- [ ] 6.5 Write property test for valid files proceed to conversion
  - **Property 14: Valid files proceed to conversion**
  - **Validates: Requirements 6.5**

- [ ] 6.6 Write unit tests for UploadController
  - Test upload with valid video file
  - Test upload with invalid file type
  - Test upload with file exceeding size limit (edge case)
  - Test upload with video without audio (edge case)
  - _Requirements: 1.1, 1.4, 2.6, 6.2_

- [ ] 7. Implement status API endpoint
  - Create endpoint GET /api/status/:jobId
  - Return job status, progress, and message
  - Handle invalid job IDs with 404 error
  - _Requirements: 5.2, 5.4_

- [ ] 7.1 Write unit tests for status endpoint
  - Test status retrieval for existing job
  - Test status retrieval for non-existent job
  - _Requirements: 5.2_

- [ ] 8. Implement DownloadController
  - Create DownloadController class
  - Implement handleDownload() for GET /api/download/:jobId
  - Verify job is completed before allowing download
  - Stream WAV file with appropriate content-type headers
  - Set filename header based on original video filename
  - Return 404 if job not found or not completed
  - Trigger cleanup after successful download
  - _Requirements: 4.1, 4.3, 4.5, 8.3_

- [ ] 8.1 Write property test for successful conversion creates downloadable file
  - **Property 6: Successful conversion creates downloadable file**
  - **Validates: Requirements 4.1**

- [ ] 8.2 Write property test for download returns correct file
  - **Property 7: Download returns correct file**
  - **Validates: Requirements 4.3**

- [ ] 8.3 Write property test for output filename derivation
  - **Property 8: Output filename derivation**
  - **Validates: Requirements 4.5**

- [ ] 8.4 Write unit tests for DownloadController
  - Test download of completed conversion
  - Test download with invalid job ID
  - Test download before conversion completes
  - _Requirements: 4.1, 4.3_

- [ ] 9. Implement cancel API endpoint
  - Create endpoint POST /api/cancel/:jobId
  - Call ConversionService.cancelJob()
  - Return updated job status
  - _Requirements: 5.5_

- [ ] 9.1 Write unit tests for cancel endpoint
  - Test cancellation of queued job
  - Test cancellation of processing job
  - _Requirements: 5.5_

- [ ] 10. Implement cleanup API endpoint
  - Create endpoint DELETE /api/cleanup/:jobId
  - Manually trigger FileManager.cleanupJob()
  - Return cleanup confirmation
  - _Requirements: 7.5_

- [ ] 11. Create Express server and wire up routes
  - Create main Express application
  - Configure CORS for frontend access
  - Set up multer middleware for file uploads
  - Register all API routes: /api/upload, /api/status/:jobId, /api/download/:jobId, /api/cancel/:jobId, /api/cleanup/:jobId
  - Add error handling middleware
  - Configure static file serving for frontend
  - Start automatic cleanup interval for old files
  - _Requirements: All_

- [ ] 12. Implement frontend HTML interface
  - Create index.html with upload form
  - Add file input with accept attribute for video files
  - Add upload button
  - Add progress bar for upload progress
  - Add status display area for conversion progress
  - Add download button (hidden until conversion completes)
  - Add error message display area
  - Style with CSS for clean, simple interface
  - _Requirements: 1.1, 1.2, 4.2, 5.1, 5.3_

- [ ] 13. Implement frontend JavaScript
  - Create upload.js for client-side logic
  - Implement file selection and validation
  - Implement upload with progress tracking using XMLHttpRequest or Fetch API
  - Implement status polling to check conversion progress
  - Update UI with progress percentage
  - Display download button when conversion completes
  - Handle and display errors
  - Implement download trigger
  - _Requirements: 1.1, 1.2, 1.5, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

- [ ] 13.1 Write property test for job isolation between users
  - **Property 21: Job isolation between users**
  - **Validates: Requirements 8.5**

- [ ] 14. Create system configuration
  - Create config.ts with SystemConfig interface
  - Set default values: maxFileSize (500MB), maxConcurrentJobs (3), fileRetentionTime (1 hour), cleanupInterval (15 minutes), conversionTimeout (30 minutes)
  - Define supportedFormats list
  - Allow configuration via environment variables
  - _Requirements: 1.4, 7.3, 8.4_

- [ ] 15. Add comprehensive error handling
  - Implement error response format with code, message, details, timestamp
  - Handle upload errors: file too large (413), invalid type (400), disk full (507)
  - Handle validation errors: no audio (400), corrupted file (400), invalid format (400)
  - Handle conversion errors: FFmpeg failure, timeout, insufficient memory
  - Handle download errors: file not found (404), file expired (410)
  - Add retry logic for transient errors
  - _Requirements: 1.4, 1.5, 5.4, 6.2, 6.3, 6.4_

- [ ] 15.1 Write unit tests for error handling
  - Test error response format
  - Test various error scenarios
  - _Requirements: 5.4, 6.4_

- [ ] 16. Checkpoint - Ensure all tests pass
  - Run all unit tests and verify they pass
  - Run all property-based tests and verify they pass
  - Fix any failing tests
  - Ask the user if questions arise

- [ ] 17. Create README with setup instructions
  - Document system requirements (Node.js, FFmpeg)
  - Provide installation instructions
  - Explain how to run the server
  - Document API endpoints
  - Include configuration options
  - Add usage examples
  - _Requirements: All_

- [ ] 18. Final verification and testing
  - Test complete upload-to-download flow with various video formats
  - Test concurrent uploads from multiple users
  - Test error scenarios (invalid files, no audio, etc.)
  - Verify file cleanup works correctly
  - Test with large video files
  - Verify audio quality preservation
  - _Requirements: All_
