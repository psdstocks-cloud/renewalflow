import { GoogleGenerativeAI } from '@google/genai';
import { env } from './env';

export const geminiClient = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : undefined;
