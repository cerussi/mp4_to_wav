/**
 * FileManager Service Tests
 * Tests for file operations, cleanup, and storage management
 * Requirements: 7.5, 8.3, 8.4
 */

import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileManager } from './FileManager';
import { v4 as uuidv4 } from 'uuid';

describe('FileManager', () => {
  const testUploadsDir = 'test-uploads';
  let fileManager: FileManager;

  beforeEach(async () => {
    fileManager = new FileManager(testUploadsDir);
    await fileManager.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testUploadsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  /**
   * **Feature: video-to-wav-converter, Property 18: Temporary file cleanup**
   * **Validates: Requirements 7.5**
   * 
   * For any conversion job (whether completed, failed, or cancelled), 
   * all temporary files (input video and output WAV) should be removed 
   * after processing or after a defined timeout.
   */
  describe('Property 18: Temporary file cleanup', () => {
    it('should clean up all files for any job after cleanupJob is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // original filename
          fc.uint8Array({ minLength: 100, maxLength: 1000 }), // file content
          async (filename, contentArray) => {
            const jobId = uuidv4();
            const fileBuffer = Buffer.from(contentArray);
            
            // Save file
            const inputPath = await fileManager.saveUploadedFile(fileBuffer, filename, jobId);
            
            // Create output file to simulate conversion
            const outputPath = fileManager.getOutputPath(jobId, filename);
            await fs.writeFile(outputPath, Buffer.from('fake wav data'));
            
            // Verify files exist
            const inputExists = await fileManager.fileExists(inputPath);
            const outputExists = await fileManager.fileExists(outputPath);
            expect(inputExists).toBe(true);
            expect(outputExists).toBe(true);
            
            // Clean up job
            await fileManager.cleanupJob(jobId);
            
            // Verify files are removed
            const inputExistsAfter = await fileManager.fileExists(inputPath);
            const outputExistsAfter = await fileManager.fileExists(outputPath);
            const jobDirExists = await fileManager.fileExists(fileManager.getJobDir(jobId));
            
            expect(inputExistsAfter).toBe(false);
            expect(outputExistsAfter).toBe(false);
            expect(jobDirExists).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clean up files after scheduled cleanup delay', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uint8Array({ minLength: 100, maxLength: 1000 }),
          fc.integer({ min: 50, max: 200 }), // delay in ms
          async (filename, contentArray, delayMs) => {
            const jobId = uuidv4();
            const fileBuffer = Buffer.from(contentArray);
            
            // Save file
            const inputPath = await fileManager.saveUploadedFile(fileBuffer, filename, jobId);
            
            // Verify file exists
            const inputExists = await fileManager.fileExists(inputPath);
            expect(inputExists).toBe(true);
            
            // Schedule cleanup
            fileManager.scheduleCleanup(jobId, delayMs);
            
            // Wait for cleanup to execute
            await new Promise(resolve => setTimeout(resolve, delayMs + 50));
            
            // Verify files are removed
            const inputExistsAfter = await fileManager.fileExists(inputPath);
            const jobDirExists = await fileManager.fileExists(fileManager.getJobDir(jobId));
            
            expect(inputExistsAfter).toBe(false);
            expect(jobDirExists).toBe(false);
          }
        ),
        { numRuns: 20 } // Fewer runs due to timing
      );
    }, 30000); // Longer timeout for this test
  });

  /**
   * **Feature: video-to-wav-converter, Property 19: Post-download cleanup**
   * **Validates: Requirements 8.3**
   * 
   * For any conversion job where the output file has been downloaded, 
   * both the input video and output WAV files should be removed from the server.
   */
  describe('Property 19: Post-download cleanup', () => {
    it('should remove both input and output files after download simulation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uint8Array({ minLength: 100, maxLength: 1000 }),
          async (filename, contentArray) => {
            const jobId = uuidv4();
            const fileBuffer = Buffer.from(contentArray);
            
            // Save input file
            const inputPath = await fileManager.saveUploadedFile(fileBuffer, filename, jobId);
            
            // Create output file (simulating conversion)
            const outputPath = fileManager.getOutputPath(jobId, filename);
            await fs.writeFile(outputPath, Buffer.from('wav data'));
            
            // Verify both files exist
            const inputExists = await fileManager.fileExists(inputPath);
            const outputExists = await fileManager.fileExists(outputPath);
            expect(inputExists).toBe(true);
            expect(outputExists).toBe(true);
            
            // Simulate download completion by cleaning up
            await fileManager.cleanupJob(jobId);
            
            // Verify both files are removed
            const inputExistsAfter = await fileManager.fileExists(inputPath);
            const outputExistsAfter = await fileManager.fileExists(outputPath);
            
            expect(inputExistsAfter).toBe(false);
            expect(outputExistsAfter).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: video-to-wav-converter, Property 20: Automatic old file cleanup**
   * **Validates: Requirements 8.4**
   * 
   * For any files that remain on the server beyond a defined maximum age 
   * without activity, the system should automatically remove them.
   */
  describe('Property 20: Automatic old file cleanup', () => {
    it('should remove files older than maxAge and keep newer files', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          fc.uint8Array({ minLength: 100, maxLength: 500 }),
          async (filenames, contentArray) => {
            const fileBuffer = Buffer.from(contentArray);
            const jobIds: string[] = [];
            
            // Create multiple jobs
            for (const filename of filenames) {
              const jobId = uuidv4();
              jobIds.push(jobId);
              await fileManager.saveUploadedFile(fileBuffer, filename, jobId);
            }
            
            // Wait a bit to age the files
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Create one more recent job
            const recentJobId = uuidv4();
            const recentFilename = 'recent.mp4';
            await fileManager.saveUploadedFile(fileBuffer, recentFilename, recentJobId);
            
            // Clean up files older than 50ms (should remove old jobs but not recent)
            const cleanedCount = await fileManager.cleanupOldFiles(50);
            
            // Verify old jobs are removed
            for (const jobId of jobIds) {
              const jobDirExists = await fileManager.fileExists(fileManager.getJobDir(jobId));
              expect(jobDirExists).toBe(false);
            }
            
            // Verify recent job still exists
            const recentJobDirExists = await fileManager.fileExists(fileManager.getJobDir(recentJobId));
            expect(recentJobDirExists).toBe(true);
            
            // Verify count is correct
            expect(cleanedCount).toBe(jobIds.length);
            
            // Clean up the recent job
            await fileManager.cleanupJob(recentJobId);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000); // Longer timeout for timing-based test
  });

  /**
   * Unit Tests for FileManager
   * Requirements: 7.5, 8.3
   */
  describe('Unit Tests', () => {
    describe('saveUploadedFile', () => {
      it('should save file and return correct path', async () => {
        const jobId = uuidv4();
        const filename = 'test-video.mp4';
        const content = Buffer.from('test content');
        
        const inputPath = await fileManager.saveUploadedFile(content, filename, jobId);
        
        expect(inputPath).toContain(jobId);
        expect(inputPath).toContain('input.mp4');
        
        const exists = await fileManager.fileExists(inputPath);
        expect(exists).toBe(true);
        
        // Verify content
        const savedContent = await fs.readFile(inputPath);
        expect(savedContent.toString()).toBe('test content');
        
        // Cleanup
        await fileManager.cleanupJob(jobId);
      });

      it('should preserve file extension', async () => {
        const jobId = uuidv4();
        const testCases = [
          { filename: 'video.mp4', expectedExt: '.mp4' },
          { filename: 'video.avi', expectedExt: '.avi' },
          { filename: 'video.mov', expectedExt: '.mov' },
          { filename: 'video.mkv', expectedExt: '.mkv' }
        ];
        
        for (const testCase of testCases) {
          const content = Buffer.from('test');
          const inputPath = await fileManager.saveUploadedFile(content, testCase.filename, jobId);
          
          expect(path.extname(inputPath)).toBe(testCase.expectedExt);
          
          await fileManager.cleanupJob(jobId);
        }
      });
    });

    describe('getOutputPath', () => {
      it('should generate correct output path with .wav extension', () => {
        const jobId = uuidv4();
        const testCases = [
          { input: 'video.mp4', expected: 'video.wav' },
          { input: 'my-video.avi', expected: 'my-video.wav' },
          { input: 'test.mov', expected: 'test.wav' }
        ];
        
        for (const testCase of testCases) {
          const outputPath = fileManager.getOutputPath(jobId, testCase.input);
          
          expect(outputPath).toContain(jobId);
          expect(path.basename(outputPath)).toBe(testCase.expected);
        }
      });
    });

    describe('cleanupJob', () => {
      it('should clean up after successful conversion', async () => {
        const jobId = uuidv4();
        const filename = 'video.mp4';
        const content = Buffer.from('test content');
        
        // Create input file
        const inputPath = await fileManager.saveUploadedFile(content, filename, jobId);
        
        // Create output file (simulating successful conversion)
        const outputPath = fileManager.getOutputPath(jobId, filename);
        await fs.writeFile(outputPath, Buffer.from('wav data'));
        
        // Verify both exist
        expect(await fileManager.fileExists(inputPath)).toBe(true);
        expect(await fileManager.fileExists(outputPath)).toBe(true);
        
        // Cleanup
        await fileManager.cleanupJob(jobId);
        
        // Verify both are removed
        expect(await fileManager.fileExists(inputPath)).toBe(false);
        expect(await fileManager.fileExists(outputPath)).toBe(false);
        expect(await fileManager.fileExists(fileManager.getJobDir(jobId))).toBe(false);
      });

      it('should clean up after failed conversion', async () => {
        const jobId = uuidv4();
        const filename = 'video.mp4';
        const content = Buffer.from('test content');
        
        // Create input file
        const inputPath = await fileManager.saveUploadedFile(content, filename, jobId);
        
        // Don't create output file (simulating failed conversion)
        
        // Verify input exists
        expect(await fileManager.fileExists(inputPath)).toBe(true);
        
        // Cleanup
        await fileManager.cleanupJob(jobId);
        
        // Verify input is removed
        expect(await fileManager.fileExists(inputPath)).toBe(false);
        expect(await fileManager.fileExists(fileManager.getJobDir(jobId))).toBe(false);
      });

      it('should not throw error when cleaning up non-existent job', async () => {
        const nonExistentJobId = uuidv4();
        
        // Should not throw
        await expect(fileManager.cleanupJob(nonExistentJobId)).resolves.not.toThrow();
      });
    });

    describe('scheduleCleanup', () => {
      it('should schedule cleanup that executes after delay', async () => {
        const jobId = uuidv4();
        const filename = 'video.mp4';
        const content = Buffer.from('test content');
        
        const inputPath = await fileManager.saveUploadedFile(content, filename, jobId);
        
        // Schedule cleanup for 100ms
        fileManager.scheduleCleanup(jobId, 100);
        
        // File should still exist immediately
        expect(await fileManager.fileExists(inputPath)).toBe(true);
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // File should be removed
        expect(await fileManager.fileExists(inputPath)).toBe(false);
      });

      it('should cancel previous scheduled cleanup when scheduling new one', async () => {
        const jobId = uuidv4();
        const filename = 'video.mp4';
        const content = Buffer.from('test content');
        
        const inputPath = await fileManager.saveUploadedFile(content, filename, jobId);
        
        // Schedule cleanup for 50ms
        fileManager.scheduleCleanup(jobId, 50);
        
        // Immediately reschedule for 200ms
        fileManager.scheduleCleanup(jobId, 200);
        
        // Wait 100ms (past first cleanup time)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // File should still exist (first cleanup was cancelled)
        expect(await fileManager.fileExists(inputPath)).toBe(true);
        
        // Wait for second cleanup
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // File should now be removed
        expect(await fileManager.fileExists(inputPath)).toBe(false);
      });
    });

    describe('cleanupOldFiles', () => {
      it('should remove only files older than maxAge', async () => {
        const oldJobId = uuidv4();
        const newJobId = uuidv4();
        const content = Buffer.from('test');
        
        // Create old file
        await fileManager.saveUploadedFile(content, 'old.mp4', oldJobId);
        
        // Wait to age the file
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create new file
        await fileManager.saveUploadedFile(content, 'new.mp4', newJobId);
        
        // Clean up files older than 50ms
        const cleanedCount = await fileManager.cleanupOldFiles(50);
        
        // Old file should be removed
        expect(await fileManager.fileExists(fileManager.getJobDir(oldJobId))).toBe(false);
        
        // New file should still exist
        expect(await fileManager.fileExists(fileManager.getJobDir(newJobId))).toBe(true);
        
        // Should have cleaned 1 file
        expect(cleanedCount).toBe(1);
        
        // Cleanup remaining
        await fileManager.cleanupJob(newJobId);
      });

      it('should return 0 when no files need cleanup', async () => {
        const jobId = uuidv4();
        const content = Buffer.from('test');
        
        await fileManager.saveUploadedFile(content, 'video.mp4', jobId);
        
        // Try to clean files older than 1 hour (nothing should be cleaned)
        const cleanedCount = await fileManager.cleanupOldFiles(3600000);
        
        expect(cleanedCount).toBe(0);
        
        // File should still exist
        expect(await fileManager.fileExists(fileManager.getJobDir(jobId))).toBe(true);
        
        // Cleanup
        await fileManager.cleanupJob(jobId);
      });
    });
  });
});
