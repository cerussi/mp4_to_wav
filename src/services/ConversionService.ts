/**
 * ConversionService
 * Manages job queue and processes video-to-WAV conversions
 * Requirements: 1.3, 5.2, 5.4, 5.5, 7.1, 7.2, 7.3
 */

import { v4 as uuidv4 } from 'uuid';
import { ConversionJob, JobStatus, ConversionStatus } from '../types';
import { FFmpegWrapper } from './FFmpegWrapper';
import { FileManager } from './FileManager';

export class ConversionService {
  private jobs: Map<string, ConversionJob>;
  private queue: string[];
  private processing: Set<string>;
  private maxConcurrentJobs: number;
  private ffmpegWrapper: FFmpegWrapper;
  private fileManager: FileManager;
  private conversionTimeout: number;

  constructor(
    maxConcurrentJobs: number = 3,
    conversionTimeout: number = 30 * 60 * 1000, // 30 minutes default
    ffmpegWrapper?: FFmpegWrapper,
    fileManager?: FileManager
  ) {
    this.jobs = new Map();
    this.queue = [];
    this.processing = new Set();
    this.maxConcurrentJobs = maxConcurrentJobs;
    this.conversionTimeout = conversionTimeout;
    this.ffmpegWrapper = ffmpegWrapper || new FFmpegWrapper();
    this.fileManager = fileManager || new FileManager();
  }

  /**
   * Queue a new conversion job
   * Requirements: 1.3, 7.2, 7.3
   */
  queueJob(inputPath: string, outputPath: string, originalFilename: string): string {
    const jobId = uuidv4();
    
    const job: ConversionJob = {
      jobId,
      inputPath,
      outputPath,
      originalFilename,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);

    // Start processing if we have capacity
    this.processNextJob();

    return jobId;
  }

  /**
   * Get job status information
   * Requirements: 5.2, 5.4
   */
  getJobStatus(jobId: string): ConversionStatus | null {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return null;
    }

    return {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      message: this.getStatusMessage(job),
      outputFile: job.status === 'completed' ? job.outputPath : undefined,
    };
  }

  /**
   * Cancel a job
   * Requirements: 5.5
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return false;
    }

    // Can only cancel queued or processing jobs
    if (job.status !== 'queued' && job.status !== 'processing') {
      return false;
    }

    // If queued, remove from queue
    if (job.status === 'queued') {
      const index = this.queue.indexOf(jobId);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
    }

    // If processing, mark for cancellation (FFmpeg process will be killed)
    if (job.status === 'processing') {
      this.processing.delete(jobId);
    }

    job.status = 'cancelled';
    job.completedAt = new Date();

    // Clean up files
    this.fileManager.cleanupJob(jobId).catch(err => {
      console.error(`Failed to cleanup cancelled job ${jobId}:`, err);
    });

    return true;
  }

  /**
   * Process the next job in the queue if capacity allows
   * Requirements: 7.1, 7.3
   */
  private processNextJob(): void {
    // Check if we have capacity
    if (this.processing.size >= this.maxConcurrentJobs) {
      return;
    }

    // Check if there are jobs in queue
    if (this.queue.length === 0) {
      return;
    }

    // Get next job (FIFO)
    const jobId = this.queue.shift()!;
    const job = this.jobs.get(jobId);

    if (!job) {
      // Job was removed, try next
      this.processNextJob();
      return;
    }

    // Mark as processing
    this.processing.add(jobId);
    job.status = 'processing';
    job.progress = 0;

    // Process the job
    this.processJob(job);
  }

  /**
   * Process a single conversion job
   * Requirements: 5.2, 5.4, 7.1
   */
  private async processJob(job: ConversionJob): Promise<void> {
    const timeoutId = setTimeout(() => {
      // Timeout reached
      job.status = 'failed';
      job.error = 'Conversion timeout exceeded';
      job.completedAt = new Date();
      this.processing.delete(job.jobId);
      this.processNextJob();
    }, this.conversionTimeout);

    try {
      // Extract audio with progress tracking
      const metadata = await this.ffmpegWrapper.extractAudio(
        job.inputPath,
        job.outputPath,
        (percent) => {
          // Update progress (ensure monotonicity)
          if (percent > job.progress) {
            job.progress = Math.min(100, percent);
          }
        }
      );

      // Check if job was cancelled during processing
      if (job.status === 'cancelled') {
        clearTimeout(timeoutId);
        return;
      }

      // Mark as completed
      job.status = 'completed';
      job.progress = 100;
      job.metadata = metadata;
      job.completedAt = new Date();

      clearTimeout(timeoutId);
    } catch (error) {
      // Handle errors
      clearTimeout(timeoutId);
      
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error occurred';
      job.completedAt = new Date();
    } finally {
      // Remove from processing set
      this.processing.delete(job.jobId);
      
      // Process next job in queue
      this.processNextJob();
    }
  }

  /**
   * Get human-readable status message
   */
  private getStatusMessage(job: ConversionJob): string {
    switch (job.status) {
      case 'queued':
        return 'Waiting in queue...';
      case 'processing':
        return `Converting audio... ${job.progress.toFixed(0)}%`;
      case 'completed':
        return 'Conversion completed successfully';
      case 'failed':
        return job.error || 'Conversion failed';
      case 'cancelled':
        return 'Conversion cancelled';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Get all jobs (for testing purposes)
   */
  getAllJobs(): ConversionJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get queue length (for testing purposes)
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get processing count (for testing purposes)
   */
  getProcessingCount(): number {
    return this.processing.size;
  }
}
