import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USD_TO_EUR = 0.92;
const INPUT_PRICE = 0.80 / 1_000_000;
const OUTPUT_PRICE = 4.00 / 1_000_000;

export async function POST(req: NextRequest) {
  try {
    const { messages, transcriptText, transcriptTitle } = await req.json();

    const system = `You are a helpful study assistant. The user is asking questions about a lecture transcript.
Answer clearly and concisely based on the transcript content.
If something is not covered in the transcript, say so honestly.

Transcript: "${transcriptTitle}"
---
${transcriptText}
---`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costEur = (inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE) * USD_TO_EUR;

    return NextResponse.json({
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      inputTokens,
      outputTokens,
      costEur,
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 });
  }
}
