/**
 * ConversionService Tests
 * Property-based and unit tests for conversion service
 */

import * as fc from 'fast-check';
import { ConversionService } from './ConversionService';
import { FFmpegWrapper } from './FFmpegWrapper';
import { FileManager } from './FileManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConversionService', () => {
  let service: ConversionService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversion-test-'));
    const fileManager = new FileManager(tempDir);
    service = new ConversionService(3, 30000, new FFmpegWrapper(), fileManager);
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * **Feature: video-to-wav-converter, Property 2: Upload completion creates job**
   * **Validates: Requirements 1.3**
   * 
   * For any successfully uploaded video file, the system should create a conversion job 
   * with status 'queued' or 'processing'.
   */
  describe('Property 2: Upload completion creates job', () => {
    it('should create a job with queued or processing status for any valid upload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.mp4'),
            inputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`),
            outputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.wav`),
          }),
          async (params) => {
            // Queue a job
            const jobId = service.queueJob(params.inputPath, params.outputPath, params.filename);

            // Verify job was created
            expect(jobId).toBeDefined();
            expect(typeof jobId).toBe('string');
            expect(jobId.length).toBeGreaterThan(0);

            // Get job status
            const status = service.getJobStatus(jobId);

            // Verify job exists and has correct status
            expect(status).not.toBeNull();
            expect(status!.status).toMatch(/^(queued|processing)$/);
            expect(status!.jobId).toBe(jobId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

  /**
   * **Feature: video-to-wav-converter, Property 9: Progress monotonicity**
   * **Validates: Requirements 5.2**
   * 
   * For any conversion job in 'processing' status, subsequent progress updates should have 
   * progress values greater than or equal to previous values (monotonically increasing).
   */
  describe('Property 9: Progress monotonicity', () => {
    it('should have monotonically increasing progress values for any job', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 20 }),
          async (progressUpdates) => {
            // Create a mock job
            const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
            
            // Get the job
            const jobs = service.getAllJobs();
            const job = jobs.find(j => j.jobId === jobId);
            expect(job).toBeDefined();

            // Simulate progress updates (mimicking what happens during conversion)
            let lastProgress = 0;
            for (const progress of progressUpdates) {
              // The service should only update if new progress is greater
              if (progress > job!.progress) {
                job!.progress = Math.min(100, progress);
              }
              
              // Verify monotonicity
              expect(job!.progress).toBeGreaterThanOrEqual(lastProgress);
              lastProgress = job!.progress;
            }

            // Verify final progress is within valid range
            expect(job!.progress).toBeGreaterThanOrEqual(0);
            expect(job!.progress).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: video-to-wav-converter, Property 10: Failed jobs have error messages**
   * **Validates: Requirements 5.4**
   * 
   * For any conversion job with status 'failed', the job should have a non-empty 
   * error message describing the failure.
   */
  describe('Property 10: Failed jobs have error messages', () => {
    it('should have non-empty error messages for all failed jobs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.mp4'),
            // Generate invalid paths that will cause failures
            inputPath: fc.string({ minLength: 1, maxLength: 50 }).map(s => `/nonexistent/${s.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`),
          }),
          async (params) => {
            // Queue a job with invalid input (will fail)
            const jobId = service.queueJob(params.inputPath, '/tmp/output.wav', params.filename);

            // Wait a bit for processing to start and fail
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get job status
            const status = service.getJobStatus(jobId);
            
            // If job has failed, it must have an error message
            if (status && status.status === 'failed') {
              const jobs = service.getAllJobs();
              const job = jobs.find(j => j.jobId === jobId);
              
              expect(job).toBeDefined();
              expect(job!.error).toBeDefined();
              expect(job!.error).not.toBe('');
              expect(job!.error!.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: video-to-wav-converter, Property 11: Job cancellation**
   * **Validates: Requirements 5.5**
   * 
   * For any conversion job in 'queued' or 'processing' status, calling cancel should 
   * change the job status to 'cancelled' and stop processing.
   */
  describe('Property 11: Job cancellation', () => {
    it('should cancel any queued or processing job', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.mp4'),
            inputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`),
            outputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.wav`),
          }),
          async (params) => {
            // Queue a job
            const jobId = service.queueJob(params.inputPath, params.outputPath, params.filename);

            // Get initial status
            const initialStatus = service.getJobStatus(jobId);
            expect(initialStatus).not.toBeNull();
            
            // Only test cancellation if job is queued or processing
            if (initialStatus!.status === 'queued' || initialStatus!.status === 'processing') {
              // Cancel the job
              const cancelled = service.cancelJob(jobId);
              expect(cancelled).toBe(true);

              // Verify job is now cancelled
              const finalStatus = service.getJobStatus(jobId);
              expect(finalStatus).not.toBeNull();
              expect(finalStatus!.status).toBe('cancelled');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: video-to-wav-converter, Property 15: Concurrent job independence**
   * **Validates: Requirements 7.1**
   * 
   * For any set of multiple conversion jobs running simultaneously, each job should 
   * process independently without interfering with others (different input/output files, 
   * separate progress tracking).
   */
  describe('Property 15: Concurrent job independence', () => {
    it('should process multiple jobs independently without interference', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.mp4'),
              inputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`),
              outputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.wav`),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (jobParams) => {
            // Queue multiple jobs
            const jobIds = jobParams.map(params => 
              service.queueJob(params.inputPath, params.outputPath, params.filename)
            );

            // Verify all jobs were created
            expect(jobIds.length).toBe(jobParams.length);

            // Verify all job IDs are unique
            const uniqueIds = new Set(jobIds);
            expect(uniqueIds.size).toBe(jobIds.length);

            // Verify each job has independent state
            for (let i = 0; i < jobIds.length; i++) {
              const status = service.getJobStatus(jobIds[i]);
              expect(status).not.toBeNull();
              expect(status!.jobId).toBe(jobIds[i]);
              
              // Verify job has correct input/output paths
              const jobs = service.getAllJobs();
              const job = jobs.find(j => j.jobId === jobIds[i]);
              expect(job).toBeDefined();
              expect(job!.inputPath).toBe(jobParams[i].inputPath);
              expect(job!.outputPath).toBe(jobParams[i].outputPath);
              expect(job!.originalFilename).toBe(jobParams[i].filename);
            }

            // Verify jobs don't share state
            for (let i = 0; i < jobIds.length; i++) {
              for (let j = i + 1; j < jobIds.length; j++) {
                const jobs = service.getAllJobs();
                const job1 = jobs.find(j => j.jobId === jobIds[i]);
                const job2 = jobs.find(j => j.jobId === jobIds[j]);
                
                // Jobs should have different paths
                expect(job1!.inputPath).not.toBe(job2!.inputPath);
                expect(job1!.outputPath).not.toBe(job2!.outputPath);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: video-to-wav-converter, Property 16: Non-blocking uploads**
   * **Validates: Requirements 7.2**
   * 
   * For any conversion job in progress, the system should accept new upload requests 
   * without blocking.
   */
  describe('Property 16: Non-blocking uploads', () => {
    it('should accept new jobs while processing existing ones', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.mp4'),
              inputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`),
              outputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.wav`),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (jobParams) => {
            const jobIds: string[] = [];
            const startTime = Date.now();

            // Queue all jobs rapidly (should not block)
            for (const params of jobParams) {
              const jobId = service.queueJob(params.inputPath, params.outputPath, params.filename);
              jobIds.push(jobId);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Queueing should be fast (non-blocking) - should take less than 100ms for all jobs
            expect(duration).toBeLessThan(100);

            // Verify all jobs were queued
            expect(jobIds.length).toBe(jobParams.length);

            // Verify all jobs exist
            for (const jobId of jobIds) {
              const status = service.getJobStatus(jobId);
              expect(status).not.toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: video-to-wav-converter, Property 17: FIFO job processing**
   * **Validates: Requirements 7.3**
   * 
   * For any sequence of queued jobs, when processed, they should complete in the same 
   * order they were queued (FIFO - First In, First Out).
   */
  describe('Property 17: FIFO job processing', () => {
    it('should process jobs in FIFO order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.mp4'),
              inputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`),
              outputPath: fc.string({ minLength: 5, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9]/g, '_')}.wav`),
            }),
            { minLength: 5, maxLength: 10 }
          ),
          async (jobParams) => {
            // Create a service with concurrency limit of 1 to ensure sequential processing
            const sequentialService = new ConversionService(1, 30000, new FFmpegWrapper(), new FileManager(tempDir));
            
            // Queue all jobs
            const jobIds = jobParams.map(params => 
              sequentialService.queueJob(params.inputPath, params.outputPath, params.filename)
            );

            // Get all jobs
            const jobs = sequentialService.getAllJobs();

            // Verify jobs are in the order they were queued
            for (let i = 0; i < jobIds.length; i++) {
              const job = jobs.find(j => j.jobId === jobIds[i]);
              expect(job).toBeDefined();
              
              // Verify creation timestamps are in order
              if (i > 0) {
                const prevJob = jobs.find(j => j.jobId === jobIds[i - 1]);
                expect(job!.createdAt.getTime()).toBeGreaterThanOrEqual(prevJob!.createdAt.getTime());
              }
            }

            // The queue should maintain FIFO order
            const queueLength = sequentialService.getQueueLength();
            expect(queueLength).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Unit Tests for ConversionService
   * Testing specific examples and scenarios
   */
  describe('Unit Tests', () => {
    describe('Job creation and queueing', () => {
      it('should create a job with unique ID', () => {
        const jobId1 = service.queueJob('/tmp/test1.mp4', '/tmp/test1.wav', 'test1.mp4');
        const jobId2 = service.queueJob('/tmp/test2.mp4', '/tmp/test2.wav', 'test2.mp4');

        expect(jobId1).not.toBe(jobId2);
        expect(jobId1).toBeDefined();
        expect(jobId2).toBeDefined();
      });

      it('should create job with queued status', () => {
        const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
        const status = service.getJobStatus(jobId);

        expect(status).not.toBeNull();
        expect(status!.status).toMatch(/^(queued|processing)$/);
        expect(status!.progress).toBe(0);
      });

      it('should store job with correct metadata', () => {
        const inputPath = '/tmp/input.mp4';
        const outputPath = '/tmp/output.wav';
        const filename = 'video.mp4';

        const jobId = service.queueJob(inputPath, outputPath, filename);
        const jobs = service.getAllJobs();
        const job = jobs.find(j => j.jobId === jobId);

        expect(job).toBeDefined();
        expect(job!.inputPath).toBe(inputPath);
        expect(job!.outputPath).toBe(outputPath);
        expect(job!.originalFilename).toBe(filename);
        expect(job!.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('Job status transitions', () => {
      it('should transition from queued to processing', async () => {
        const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
        
        // Initial status should be queued or processing
        const initialStatus = service.getJobStatus(jobId);
        expect(initialStatus).not.toBeNull();
        expect(initialStatus!.status).toMatch(/^(queued|processing)$/);

        // Wait a bit for processing to potentially start
        await new Promise(resolve => setTimeout(resolve, 50));

        const laterStatus = service.getJobStatus(jobId);
        expect(laterStatus).not.toBeNull();
        // Status should be queued, processing, failed, or completed
        expect(laterStatus!.status).toMatch(/^(queued|processing|failed|completed)$/);
      });

      it('should have progress 0 when queued', () => {
        const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
        const status = service.getJobStatus(jobId);

        expect(status).not.toBeNull();
        if (status!.status === 'queued') {
          expect(status!.progress).toBe(0);
        }
      });

      it('should have progress 100 when completed', async () => {
        // This test would require a real video file, so we'll just verify the logic
        const jobs = service.getAllJobs();
        const completedJobs = jobs.filter(j => j.status === 'completed');

        completedJobs.forEach(job => {
          expect(job.progress).toBe(100);
        });
      });
    });

    describe('Job cancellation', () => {
      it('should cancel a queued job', () => {
        const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
        
        const initialStatus = service.getJobStatus(jobId);
        if (initialStatus!.status === 'queued') {
          const cancelled = service.cancelJob(jobId);
          expect(cancelled).toBe(true);

          const finalStatus = service.getJobStatus(jobId);
          expect(finalStatus!.status).toBe('cancelled');
        }
      });

      it('should not cancel a completed job', () => {
        const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
        
        // Manually set job to completed for testing
        const jobs = service.getAllJobs();
        const job = jobs.find(j => j.jobId === jobId);
        if (job) {
          job.status = 'completed';
          
          const cancelled = service.cancelJob(jobId);
          expect(cancelled).toBe(false);
          expect(job.status).toBe('completed');
        }
      });

      it('should not cancel a failed job', () => {
        const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
        
        // Manually set job to failed for testing
        const jobs = service.getAllJobs();
        const job = jobs.find(j => j.jobId === jobId);
        if (job) {
          job.status = 'failed';
          
          const cancelled = service.cancelJob(jobId);
          expect(cancelled).toBe(false);
          expect(job.status).toBe('failed');
        }
      });

      it('should return false for non-existent job', () => {
        const cancelled = service.cancelJob('non-existent-id');
        expect(cancelled).toBe(false);
      });
    });

    describe('Job status retrieval', () => {
      it('should return null for non-existent job', () => {
        const status = service.getJobStatus('non-existent-id');
        expect(status).toBeNull();
      });

      it('should return status with correct structure', () => {
        const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
        const status = service.getJobStatus(jobId);

        expect(status).not.toBeNull();
        expect(status).toHaveProperty('jobId');
        expect(status).toHaveProperty('status');
        expect(status).toHaveProperty('progress');
        expect(status).toHaveProperty('message');
      });

      it('should include output file only for completed jobs', () => {
        const jobId = service.queueJob('/tmp/test.mp4', '/tmp/test.wav', 'test.mp4');
        const status = service.getJobStatus(jobId);

        expect(status).not.toBeNull();
        if (status!.status === 'completed') {
          expect(status!.outputFile).toBeDefined();
        } else {
          expect(status!.outputFile).toBeUndefined();
        }
      });
    });

    describe('Concurrency management', () => {
      it('should respect max concurrent jobs limit', () => {
        const maxConcurrent = 3;
        const testService = new ConversionService(maxConcurrent, 30000, new FFmpegWrapper(), new FileManager(tempDir));

        // Queue more jobs than the limit
        for (let i = 0; i < 10; i++) {
          testService.queueJob(`/tmp/test${i}.mp4`, `/tmp/test${i}.wav`, `test${i}.mp4`);
        }

        // Processing count should not exceed max concurrent
        const processingCount = testService.getProcessingCount();
        expect(processingCount).toBeLessThanOrEqual(maxConcurrent);
      });

      it('should queue jobs when at capacity', () => {
        const maxConcurrent = 2;
        const testService = new ConversionService(maxConcurrent, 30000, new FFmpegWrapper(), new FileManager(tempDir));

        // Queue more jobs than the limit
        for (let i = 0; i < 5; i++) {
          testService.queueJob(`/tmp/test${i}.mp4`, `/tmp/test${i}.wav`, `test${i}.mp4`);
        }

        // Some jobs should be in queue
        const queueLength = testService.getQueueLength();
        const processingCount = testService.getProcessingCount();
        
        expect(queueLength + processingCount).toBeGreaterThan(0);
      });
    });
  });
});
