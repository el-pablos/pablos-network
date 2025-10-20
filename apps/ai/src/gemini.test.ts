import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables before importing
process.env.GEMINI_API_KEY = 'test-api-key-123';

// Mock logger
vi.mock('@pablos/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock Google Generative AI
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('Gemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateWithGemini', () => {
    it('should generate text response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Generated text response',
        },
      });

      const { generateWithGemini } = await import('./gemini');
      const result = await generateWithGemini('Test prompt');

      expect(result).toBe('Generated text response');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-pro' });
      expect(mockGenerateContent).toHaveBeenCalledWith('Test prompt');
    });

    it('should include system instruction in prompt', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Response with system instruction',
        },
      });

      const { generateWithGemini } = await import('./gemini');
      const result = await generateWithGemini('User prompt', 'System instruction');

      expect(mockGenerateContent).toHaveBeenCalledWith('System instruction\n\nUser prompt');
      expect(result).toBe('Response with system instruction');
    });

    it('should handle API errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API rate limit exceeded'));

      const { generateWithGemini } = await import('./gemini');

      await expect(generateWithGemini('Test prompt')).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('generateJSONWithGemini', () => {
    it('should parse JSON response', async () => {
      const jsonResponse = { key: 'value', number: 42 };
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(jsonResponse),
        },
      });

      const { generateJSONWithGemini } = await import('./gemini');
      const result = await generateJSONWithGemini('Test prompt');

      expect(result).toEqual(jsonResponse);
    });

    it('should extract JSON from markdown code blocks with json tag', async () => {
      const jsonResponse = { extracted: true };
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => `Here is the JSON:\n\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\`\nDone.`,
        },
      });

      const { generateJSONWithGemini } = await import('./gemini');
      const result = await generateJSONWithGemini('Test prompt');

      expect(result).toEqual(jsonResponse);
    });

    it('should extract JSON from markdown code blocks without json tag', async () => {
      const jsonResponse = { extracted: true, noTag: true };
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => `\`\`\`\n${JSON.stringify(jsonResponse)}\n\`\`\``,
        },
      });

      const { generateJSONWithGemini } = await import('./gemini');
      const result = await generateJSONWithGemini('Test prompt');

      expect(result).toEqual(jsonResponse);
    });

    it('should throw error for invalid JSON', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'This is not valid JSON',
        },
      });

      const { generateJSONWithGemini } = await import('./gemini');

      await expect(generateJSONWithGemini('Test prompt')).rejects.toThrow('Invalid JSON response from Gemini');
    });

    it('should include system instruction', async () => {
      const jsonResponse = { withInstruction: true };
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(jsonResponse),
        },
      });

      const { generateJSONWithGemini } = await import('./gemini');
      const result = await generateJSONWithGemini('User prompt', 'System instruction');

      expect(mockGenerateContent).toHaveBeenCalledWith('System instruction\n\nUser prompt');
      expect(result).toEqual(jsonResponse);
    });
  });

  describe('API Key Validation', () => {
    it('should throw error when GEMINI_API_KEY is not configured', async () => {
      // Clear the module cache
      vi.resetModules();
      
      // Temporarily remove API key
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      // Re-mock the logger
      vi.mock('@pablos/utils', () => ({
        createLogger: () => ({
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
        }),
      }));

      // Importing should throw
      await expect(async () => {
        await import('./gemini');
      }).rejects.toThrow('GEMINI_API_KEY not configured');

      // Restore API key
      process.env.GEMINI_API_KEY = originalKey;
    });
  });
});

