import { Module } from "@nestjs/common";
import { GeminiClient } from "./gemini.client";

/**
 * The one shared connection to Google's Gemini. Lycie's chat, the deals finder and the market
 * briefing all import this, so they share a single client — and therefore a single memory of which
 * models are overloaded or out of quota right now.
 */
@Module({
  providers: [GeminiClient],
  exports: [GeminiClient],
})
export class GeminiModule {}
