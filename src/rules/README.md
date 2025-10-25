# Rule Engine

This directory contains the core rule matching and evaluation engine.

## Structure

- `engine.ts` - Core rule engine that matches and evaluates rules
- `matcher.ts` - Rule matching logic
- `evaluator.ts` - Condition evaluation
- `predetermined/` - Pre-built moderation rules (spam, hate speech, etc.)
- `custom/` - Custom rule configuration and evaluation

## Purpose

The rule engine is the brain of the automod. It receives content from handlers, matches applicable rules, evaluates conditions, and determines what actions to take.
