import { Module } from "@nestjs/common";
import { GeminiModule } from "../lycie/gemini.module";
import { ResearchService } from "./research.service";

@Module({
  imports: [GeminiModule],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
