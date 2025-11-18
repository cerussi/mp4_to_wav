/**
 * FFmpegWrapper Tests
 * Property-based and unit tests for FFmpeg wrapper service
 */

import * as fc from 'fast-check';
import { FFmpegWrapper } from './FFmpegWrapper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';

describe('FFmpegWrapper', () => {
  let wrapper: FFmpegWrapper;
  let tempDir: string;

  beforeAll(() => {
    wrapper = new FFmpegWrapper();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-test-'));
  });

  afterAll(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * **Feature: video-to-wav-converter, Property 4: Audio parameters preservation**
   * **Validates: Requirements 3.1**
   * 
   * For any video file with audio stream, the extracted WAV file should preserve 
   * the original sample rate and bit depth without resampling or lossy reencoding.
   */
  describe('Property 4: Audio parameters preservation', () => {
    it('should preserve original sample rate and bit depth for any video with audio', async () => {
      // Generate test cases with different audio parameters
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sampleRate: fc.constantFrom(44100, 48000, 96000),
            bitDepth: fc.constantFrom(16, 24),
            channels: fc.constantFrom(1, 2),
          }),
          async (audioParams) => {
            // Create a test video file with specific audio parameters
            const inputPath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.mp4`);
            const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random()}.wav`);

            try {
              // Generate a test video with specific audio parameters
              await generateTestVideo(inputPath, audioParams);

              // Extract audio using FFmpegWrapper
              const extractedMetadata = await wrapper.extractAudio(inputPath, outputPath);

              // Verify the output WAV file exists
              expect(fs.existsSync(outputPath)).toBe(true);

              // Verify sample rate is preserved
              expect(extractedMetadata.sampleRate).toBe(audioParams.sampleRate);

              // Verify bit depth is preserved
              expect(extractedMetadata.bitDepth).toBe(audioParams.bitDepth);

              // Verify channels are preserved
              expect(extractedMetadata.channels).toBe(audioParams.channels);

              // Verify the output is actually a WAV file with PCM encoding
              const outputMetadata = await getAudioCodec(outputPath);
              expect(outputMetadata.codec).toMatch(/pcm/i);

            } finally {
              // Cleanup test files
              if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }
          }
        ),
        { numRuns: 10 } // Run 10 iterations with different parameters
      );
    }, 120000); // 2 minute timeout for video generation and conversion
  });

  /**
   * **Feature: video-to-wav-converter, Property 5: PCM encoding**
   * **Validates: Requirements 3.2**
   * 
   * For any generated WAV file, the audio codec should be PCM (uncompressed).
   */
  describe('Property 5: PCM encoding', () => {
    it('should use PCM codec for all generated WAV files', async () => {
      // Generate test cases with different video formats and audio codecs
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            videoFormat: fc.constantFrom('mp4', 'avi', 'mov', 'mkv'),
            audioCodec: fc.constantFrom('aac', 'mp3', 'opus'),
            sampleRate: fc.constantFrom(44100, 48000),
          }),
          async (params) => {
            const inputPath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.${params.videoFormat}`);
            const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random()}.wav`);

            try {
              // Generate a test video with specific format and audio codec
              await generateTestVideoWithCodec(inputPath, params);

              // Extract audio using FFmpegWrapper
              await wrapper.extractAudio(inputPath, outputPath);

              // Verify the output uses PCM codec
              const outputMetadata = await getAudioCodec(outputPath);
              
              // PCM codec should be one of: pcm_s16le, pcm_s24le, pcm_s32le
              expect(outputMetadata.codec).toMatch(/^pcm_s(16|24|32)le$/);

            } finally {
              // Cleanup test files
              if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }
          }
        ),
        { numRuns: 10 } // Run 10 iterations with different formats
      );
    }, 120000); // 2 minute timeout
  });

  /**
   * Unit Tests for FFmpegWrapper
   * Testing specific examples and edge cases
   */
  describe('Unit Tests', () => {
    describe('getVideoMetadata', () => {
      it('should extract metadata from MP4 file', async () => {
        const inputPath = path.join(tempDir, `test-mp4-${Date.now()}.mp4`);
        
        try {
          await generateTestVideo(inputPath, { sampleRate: 48000, bitDepth: 16, channels: 2 });
          
          const metadata = await wrapper.getVideoMetadata(inputPath);
          
          expect(metadata.hasVideo).toBe(true);
          expect(metadata.hasAudio).toBe(true);
          expect(metadata.format).toContain('mp4');
          expect(metadata.duration).toBeGreaterThan(0);
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        }
      }, 60000);

      it('should extract metadata from AVI file', async () => {
        const inputPath = path.join(tempDir, `test-avi-${Date.now()}.avi`);
        
        try {
          await generateTestVideoWithFormat(inputPath, 'avi');
          
          const metadata = await wrapper.getVideoMetadata(inputPath);
          
          expect(metadata.hasVideo).toBe(true);
          expect(metadata.hasAudio).toBe(true);
          expect(metadata.format).toContain('avi');
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        }
      }, 60000);

      it('should extract metadata from MOV file', async () => {
        const inputPath = path.join(tempDir, `test-mov-${Date.now()}.mov`);
        
        try {
          await generateTestVideoWithFormat(inputPath, 'mov');
          
          const metadata = await wrapper.getVideoMetadata(inputPath);
          
          expect(metadata.hasVideo).toBe(true);
          expect(metadata.hasAudio).toBe(true);
          expect(metadata.format).toMatch(/mov|mp4|m4a|3gp|3g2|mj2/);
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        }
      }, 60000);

      it('should extract metadata from MKV file', async () => {
        const inputPath = path.join(tempDir, `test-mkv-${Date.now()}.mkv`);
        
        try {
          await generateTestVideoWithFormat(inputPath, 'mkv');
          
          const metadata = await wrapper.getVideoMetadata(inputPath);
          
          expect(metadata.hasVideo).toBe(true);
          expect(metadata.hasAudio).toBe(true);
          expect(metadata.format).toContain('matroska');
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        }
      }, 60000);

      it('should extract metadata from WebM file', async () => {
        const inputPath = path.join(tempDir, `test-webm-${Date.now()}.webm`);
        
        try {
          await generateTestVideoWithFormat(inputPath, 'webm');
          
          const metadata = await wrapper.getVideoMetadata(inputPath);
          
          expect(metadata.hasVideo).toBe(true);
          expect(metadata.hasAudio).toBe(true);
          expect(metadata.format).toContain('webm');
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        }
      }, 60000);
    });

    describe('validateVideoFile', () => {
      it('should return true for valid video file', async () => {
        const inputPath = path.join(tempDir, `test-valid-${Date.now()}.mp4`);
        
        try {
          await generateTestVideo(inputPath, { sampleRate: 48000, bitDepth: 16, channels: 2 });
          
          const isValid = await wrapper.validateVideoFile(inputPath);
          
          expect(isValid).toBe(true);
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        }
      }, 60000);

      it('should return false for corrupted file', async () => {
        const inputPath = path.join(tempDir, `test-corrupted-${Date.now()}.mp4`);
        
        try {
          // Create a corrupted file with random data
          fs.writeFileSync(inputPath, 'This is not a valid video file');
          
          const isValid = await wrapper.validateVideoFile(inputPath);
          
          expect(isValid).toBe(false);
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        }
      });

      it('should return false for non-existent file', async () => {
        const inputPath = path.join(tempDir, `non-existent-${Date.now()}.mp4`);
        
        const isValid = await wrapper.validateVideoFile(inputPath);
        
        expect(isValid).toBe(false);
      });
    });

    describe('extractAudio', () => {
      it('should preserve 44.1kHz sample rate', async () => {
        const inputPath = path.join(tempDir, `test-44100-${Date.now()}.mp4`);
        const outputPath = path.join(tempDir, `output-44100-${Date.now()}.wav`);
        
        try {
          await generateTestVideo(inputPath, { sampleRate: 44100, bitDepth: 16, channels: 2 });
          
          const metadata = await wrapper.extractAudio(inputPath, outputPath);
          
          expect(metadata.sampleRate).toBe(44100);
          expect(fs.existsSync(outputPath)).toBe(true);
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }, 60000);

      it('should preserve 48kHz sample rate', async () => {
        const inputPath = path.join(tempDir, `test-48000-${Date.now()}.mp4`);
        const outputPath = path.join(tempDir, `output-48000-${Date.now()}.wav`);
        
        try {
          await generateTestVideo(inputPath, { sampleRate: 48000, bitDepth: 16, channels: 2 });
          
          const metadata = await wrapper.extractAudio(inputPath, outputPath);
          
          expect(metadata.sampleRate).toBe(48000);
          expect(fs.existsSync(outputPath)).toBe(true);
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }, 60000);

      it('should preserve 16-bit depth', async () => {
        const inputPath = path.join(tempDir, `test-16bit-${Date.now()}.mp4`);
        const outputPath = path.join(tempDir, `output-16bit-${Date.now()}.wav`);
        
        try {
          await generateTestVideo(inputPath, { sampleRate: 48000, bitDepth: 16, channels: 2 });
          
          const metadata = await wrapper.extractAudio(inputPath, outputPath);
          
          expect(metadata.bitDepth).toBe(16);
          
          // Verify PCM codec
          const outputMetadata = await getAudioCodec(outputPath);
          expect(outputMetadata.codec).toBe('pcm_s16le');
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }, 60000);

      it('should preserve 24-bit depth', async () => {
        const inputPath = path.join(tempDir, `test-24bit-${Date.now()}.mp4`);
        const outputPath = path.join(tempDir, `output-24bit-${Date.now()}.wav`);
        
        try {
          await generateTestVideo(inputPath, { sampleRate: 48000, bitDepth: 24, channels: 2 });
          
          const metadata = await wrapper.extractAudio(inputPath, outputPath);
          
          expect(metadata.bitDepth).toBe(24);
          
          // Verify PCM codec
          const outputMetadata = await getAudioCodec(outputPath);
          expect(outputMetadata.codec).toBe('pcm_s24le');
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }, 60000);

      it('should reject video without audio stream', async () => {
        const inputPath = path.join(tempDir, `test-no-audio-${Date.now()}.mp4`);
        const outputPath = path.join(tempDir, `output-no-audio-${Date.now()}.wav`);
        
        try {
          // Generate video without audio
          await generateVideoWithoutAudio(inputPath);
          
          await expect(wrapper.extractAudio(inputPath, outputPath)).rejects.toThrow('no audio stream');
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }, 60000);

      it('should call progress callback during conversion', async () => {
        const inputPath = path.join(tempDir, `test-progress-${Date.now()}.mp4`);
        const outputPath = path.join(tempDir, `output-progress-${Date.now()}.wav`);
        
        try {
          await generateTestVideo(inputPath, { sampleRate: 48000, bitDepth: 16, channels: 2 });
          
          const progressValues: number[] = [];
          const onProgress = (percent: number) => {
            progressValues.push(percent);
          };
          
          await wrapper.extractAudio(inputPath, outputPath, onProgress);
          
          // Verify progress callback was called
          expect(progressValues.length).toBeGreaterThan(0);
          
          // Verify progress values are between 0 and 100
          progressValues.forEach(value => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
          });
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }, 60000);
    });
  });
});

/**
 * Helper function to generate a test video with specific audio parameters
 */
function generateTestVideo(
  outputPath: string,
  audioParams: { sampleRate: number; bitDepth: number; channels: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Determine PCM format based on bit depth
    let pcmFormat = 's16le';
    if (audioParams.bitDepth === 24) {
      pcmFormat = 's24le';
    } else if (audioParams.bitDepth === 32) {
      pcmFormat = 's32le';
    }

    // Generate a test video with audio using FFmpeg
    // Using anullsrc to generate silent audio with specific parameters
    ffmpeg()
      .input(`anullsrc=channel_layout=${audioParams.channels === 1 ? 'mono' : 'stereo'}:sample_rate=${audioParams.sampleRate}`)
      .inputFormat('lavfi')
      .input('color=c=black:s=320x240:d=1')
      .inputFormat('lavfi')
      .outputOptions([
        '-t 1', // 1 second duration
        `-sample_fmt ${pcmFormat}`,
        '-shortest'
      ])
      .audioCodec('aac')
      .videoCodec('libx264')
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Failed to generate test video: ${err.message}`)))
      .save(outputPath);
  });
}

/**
 * Helper function to generate a test video with specific codec
 */
function generateTestVideoWithCodec(
  outputPath: string,
  params: { videoFormat: string; audioCodec: string; sampleRate: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Generate a test video with specific audio codec
    ffmpeg()
      .input(`anullsrc=channel_layout=stereo:sample_rate=${params.sampleRate}`)
      .inputFormat('lavfi')
      .input('color=c=black:s=320x240:d=1')
      .inputFormat('lavfi')
      .outputOptions([
        '-t 1', // 1 second duration
        '-shortest'
      ])
      .audioCodec(params.audioCodec)
      .videoCodec('libx264')
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Failed to generate test video: ${err.message}`)))
      .save(outputPath);
  });
}

/**
 * Helper function to generate a test video with specific format
 */
function generateTestVideoWithFormat(outputPath: string, format: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input('anullsrc=channel_layout=stereo:sample_rate=48000')
      .inputFormat('lavfi')
      .input('color=c=black:s=320x240:d=1')
      .inputFormat('lavfi')
      .outputOptions([
        '-t 1',
        '-shortest'
      ])
      .audioCodec('aac');

    // Set video codec based on format
    if (format === 'webm') {
      command.videoCodec('libvpx');
    } else {
      command.videoCodec('libx264');
    }

    command
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Failed to generate test video: ${err.message}`)))
      .save(outputPath);
  });
}

/**
 * Helper function to generate a video without audio stream
 */
function generateVideoWithoutAudio(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('color=c=black:s=320x240:d=1')
      .inputFormat('lavfi')
      .outputOptions(['-t 1'])
      .videoCodec('libx264')
      .noAudio()
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Failed to generate video without audio: ${err.message}`)))
      .save(outputPath);
  });
}

/**
 * Helper function to get audio codec from a file
 */
function getAudioCodec(filePath: string): Promise<{ codec: string }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      if (!audioStream) {
        reject(new Error('No audio stream found'));
        return;
      }

      resolve({ codec: audioStream.codec_name || 'unknown' });
    });
  });
}
