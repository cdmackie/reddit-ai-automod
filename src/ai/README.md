# AI Integration Layer

This directory contains AI provider integrations and prompt management.

## Structure

- `providers/` - AI provider implementations (OpenAI, Gemini)
- `prompts/` - Prompt templates for different moderation scenarios
- `router.ts` - Routes requests to appropriate AI provider
- `cache.ts` - AI response caching to reduce costs
- `types.ts` - Type definitions for AI responses

## Purpose

Handles all AI analysis of content. Uses a two-stage approach: Stage 1 (OpenAI Moderation API - free) for initial screening, Stage 2 (GPT-4/Gemini - paid) for edge cases requiring deeper analysis.
