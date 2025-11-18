/**
 * FFmpegWrapper Service
 * Handles video metadata extraction and audio conversion using FFmpeg
 * Requirements: 3.1, 3.2, 6.1
 */

import ffmpeg from 'fluent-ffmpeg';
import { AudioMetadata, VideoMetadata } from '../types';
import { promisify } from 'util';

export class FFmpegWrapper {
  /**
   * Extract video metadata including audio and video stream information
   * @param inputPath Path to the video file
   * @returns Promise<VideoMetadata> Video metadata information
   */
  async getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to extract metadata: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');

        const videoMetadata: VideoMetadata = {
          hasAudio: !!audioStream,
          hasVideo: !!videoStream,
          duration: metadata.format.duration || 0,
          format: metadata.format.format_name || 'unknown',
          audioCodec: audioStream?.codec_name,
        };

        resolve(videoMetadata);
      });
    });
  }

  /**
   * Validate if the file has valid video streams
   * @param inputPath Path to the video file
   * @returns Promise<boolean> True if file has valid video streams
   */
  async validateVideoFile(inputPath: string): Promise<boolean> {
    try {
      const metadata = await this.getVideoMetadata(inputPath);
      return metadata.hasVideo;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract audio from video file and convert to lossless WAV format
   * Preserves original sample rate and bit depth using PCM codec
   * @param inputPath Path to the input video file
   * @param outputPath Path for the output WAV file
   * @param onProgress Callback function for progress updates (0-100)
   * @returns Promise<AudioMetadata> Metadata of the extracted audio
   */
  async extractAudio(
    inputPath: string,
    outputPath: string,
    onProgress?: (percent: number) => void
  ): Promise<AudioMetadata> {
    return new Promise(async (resolve, reject) => {
      try {
        // First, get the audio metadata to preserve original parameters
        const videoMetadata = await this.getVideoMetadata(inputPath);
        
        if (!videoMetadata.hasAudio) {
          reject(new Error('Video file contains no audio stream'));
          return;
        }

        // Get detailed audio information
        const audioInfo = await this.getAudioInfo(inputPath);

        // Determine PCM codec based on bit depth
        let pcmCodec = 'pcm_s16le'; // Default to 16-bit
        if (audioInfo.bitDepth === 24) {
          pcmCodec = 'pcm_s24le';
        } else if (audioInfo.bitDepth === 32) {
          pcmCodec = 'pcm_s32le';
        }

        // Start FFmpeg conversion
        const command = ffmpeg(inputPath)
          .noVideo() // Disable video recording (audio only)
          .audioCodec(pcmCodec) // Use PCM codec for lossless conversion
          .audioFrequency(audioInfo.sampleRate) // Preserve original sample rate
          .audioChannels(audioInfo.channels) // Preserve channel count
          .format('wav') // Output format
          .on('progress', (progress) => {
            if (onProgress && progress.percent) {
              onProgress(Math.min(100, Math.max(0, progress.percent)));
            }
          })
          .on('end', () => {
            resolve(audioInfo);
          })
          .on('error', (err) => {
            reject(new Error(`FFmpeg conversion failed: ${err.message}`));
          });

        command.save(outputPath);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get detailed audio information from video file
   * @param inputPath Path to the video file
   * @returns Promise<AudioMetadata> Detailed audio metadata
   */
  private async getAudioInfo(inputPath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to extract audio info: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        
        if (!audioStream) {
          reject(new Error('No audio stream found'));
          return;
        }

        // Extract audio parameters
        const sampleRate = audioStream.sample_rate || 48000;
        const channels = audioStream.channels || 2;
        const duration = metadata.format.duration || 0;
        const codec = audioStream.codec_name || 'unknown';
        const bitrate = audioStream.bit_rate ? parseInt(audioStream.bit_rate as string) : 0;
        
        // Determine bit depth from codec or sample format
        let bitDepth = 16; // Default
        const sampleFmt = audioStream.sample_fmt;
        if (sampleFmt) {
          if (sampleFmt.includes('s32') || sampleFmt.includes('flt') || sampleFmt.includes('dbl')) {
            bitDepth = 32;
          } else if (sampleFmt.includes('s24')) {
            bitDepth = 24;
          } else if (sampleFmt.includes('s16')) {
            bitDepth = 16;
          }
        }

        const audioMetadata: AudioMetadata = {
          sampleRate,
          bitDepth,
          channels,
          duration,
          codec,
          bitrate,
        };

        resolve(audioMetadata);
      });
    });
  }
}
