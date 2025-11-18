/**
 * FileManager Service
 * Manages file operations including storage, path generation, and cleanup
 * Requirements: 7.5, 8.2, 8.3, 8.4
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class FileManager {
  private uploadsDir: string;
  private cleanupTimers: Map<string, NodeJS.Timeout>;

  constructor(uploadsDir: string = 'uploads') {
    this.uploadsDir = uploadsDir;
    this.cleanupTimers = new Map();
  }

  /**
   * Initialize the uploads directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to initialize uploads directory: ${error}`);
    }
  }

  /**
   * Save uploaded file to unique job directory
   * Requirements: 8.2
   */
  async saveUploadedFile(fileBuffer: Buffer, originalFilename: string, jobId: string): Promise<string> {
    const jobDir = path.join(this.uploadsDir, jobId);
    
    // Create job directory
    await fs.mkdir(jobDir, { recursive: true });
    
    // Extract extension from original filename
    const ext = path.extname(originalFilename);
    const inputPath = path.join(jobDir, `input${ext}`);
    
    // Write file to disk
    await fs.writeFile(inputPath, fileBuffer);
    
    return inputPath;
  }

  /**
   * Generate output WAV file path for a job
   * Requirements: 8.2
   */
  getOutputPath(jobId: string, originalFilename: string): string {
    const jobDir = path.join(this.uploadsDir, jobId);
    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    return path.join(jobDir, `${baseName}.wav`);
  }

  /**
   * Clean up job directory and all files
   * Requirements: 7.5, 8.3
   */
  async cleanupJob(jobId: string): Promise<void> {
    const jobDir = path.join(this.uploadsDir, jobId);
    
    // Cancel any scheduled cleanup for this job
    if (this.cleanupTimers.has(jobId)) {
      clearTimeout(this.cleanupTimers.get(jobId)!);
      this.cleanupTimers.delete(jobId);
    }
    
    try {
      // Remove entire job directory
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Schedule cleanup for a job after a delay
   * Requirements: 7.5, 8.3
   */
  scheduleCleanup(jobId: string, delayMs: number): void {
    // Cancel existing timer if any
    if (this.cleanupTimers.has(jobId)) {
      clearTimeout(this.cleanupTimers.get(jobId)!);
    }
    
    // Schedule new cleanup
    const timer = setTimeout(async () => {
      await this.cleanupJob(jobId);
      this.cleanupTimers.delete(jobId);
    }, delayMs);
    
    this.cleanupTimers.set(jobId, timer);
  }

  /**
   * Clean up files older than specified age
   * Requirements: 8.4
   */
  async cleanupOldFiles(maxAgeMs: number): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();
    
    try {
      const entries = await fs.readdir(this.uploadsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const jobDir = path.join(this.uploadsDir, entry.name);
          
          try {
            const stats = await fs.stat(jobDir);
            const age = now - stats.mtimeMs;
            
            if (age > maxAgeMs) {
              await fs.rm(jobDir, { recursive: true, force: true });
              cleanedCount++;
              
              // Remove timer if exists
              if (this.cleanupTimers.has(entry.name)) {
                clearTimeout(this.cleanupTimers.get(entry.name)!);
                this.cleanupTimers.delete(entry.name);
              }
            }
          } catch (error) {
            // Skip if directory was already deleted
            continue;
          }
        }
      }
    } catch (error) {
      // If uploads directory doesn't exist, nothing to clean
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get job directory path
   */
  getJobDir(jobId: string): string {
    return path.join(this.uploadsDir, jobId);
  }
}
