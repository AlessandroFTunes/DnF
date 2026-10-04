/** "K7Q2XMH4" → "K7Q2-XMH4" (mais fácil de ditar). */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
