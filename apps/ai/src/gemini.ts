import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '@pablos/utils';

const logger = createLogger('gemini');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY not configured');
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function generateWithGemini(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
    });

    const fullPrompt = systemInstruction 
      ? `${systemInstruction}\n\n${prompt}`
      : prompt;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    logger.debug({ promptLength: prompt.length, responseLength: text.length }, 'Gemini response received');
    
    return text;
  } catch (error) {
    logger.error({ error }, 'Gemini API error');
    throw error;
  }
}

export async function generateJSONWithGemini<T = any>(
  prompt: string,
  systemInstruction?: string
): Promise<T> {
  const text = await generateWithGemini(prompt, systemInstruction);
  
  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;
  
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    logger.error({ error, text: jsonText }, 'Failed to parse Gemini JSON response');
    throw new Error('Invalid JSON response from Gemini');
  }
}

