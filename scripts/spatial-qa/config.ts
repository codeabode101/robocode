import path from 'path';

export const BASE_URL = process.env.QA_BASE_URL || 'https://robocode.rahejaom.workers.dev';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const OUTPUT_DIR = path.resolve(__dirname, 'output');
export const FRAMES_DIR = path.resolve(__dirname, 'output/frames');
