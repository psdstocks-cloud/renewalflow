import { GoogleGenAI } from '@google/genai';
import { env } from './env';

export const geminiClient = env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  : undefined;
