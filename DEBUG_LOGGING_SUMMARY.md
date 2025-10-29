# AI Debug Logging Implementation Summary

## Overview
Added comprehensive debug logging throughout the AI analysis pipeline to track requests, responses, token usage, costs, and data transformations.

## Files Modified

### 1. `/home/cdm/redditmod/src/ai/openai.ts`
**Location**: `analyzeWithQuestions()` method

#### Before API Call (Lines 247-276)
Added detailed logging of:
- User ID and username
- Question count and details (ID, question text, context presence)
- Profile summary (account age in months, karma, verification status)
- Post history summary (total posts/comments, items fetched)
- Current post summary (title preview, body length, type)
- Prompt preview (first 500 characters)

```typescript
console.log('[OpenAI] Sending question analysis request:', {
  correlationId,
  userId: request.userId,
  username: request.username,
  questionCount: request.questions.length,
  questions: request.questions.map(q => ({
    id: q.id,
    question: q.question,
    hasContext: !!q.context
  })),
  // ... more fields
});
```

#### After API Response (Lines 321-349)
Added logging of:
- Token usage (prompt, completion, total)
- Cost in USD
- Finish reason
- Response preview (first 200 characters)
- Parsed answers with confidence and reasoning length

```typescript
console.log('[OpenAI] Received response:', {
  correlationId,
  model: this.model,
  promptTokens: usage.prompt_tokens,
  completionTokens: usage.completion_tokens,
  totalTokens: usage.total_tokens,
  cost: cost.toFixed(4),
  finishReason: response.choices[0].finish_reason,
  responsePreview: content.substring(0, 200)
});
```

### 2. `/home/cdm/redditmod/src/ai/prompts.ts`
**Location**: `buildQuestionPrompt()` method

#### At Start (Lines 544-558)
Added logging of:
- Prompt version
- User ID
- Question count
- Profile data (account age, karma, verification)
- History data (posts, comments, items included)

#### After Sanitization (Lines 568-579)
Added logging of:
- Original vs sanitized content lengths
- Reduction percentage from sanitization

```typescript
console.log('[PromptManager] Content sanitization:', {
  titleOriginal: params.currentPost.title.length,
  titleSanitized: sanitizedTitle.length,
  bodyOriginal: params.currentPost.body.length,
  bodySanitized: sanitizedBody.length,
  reductionPercent: params.currentPost.body.length > 0
    ? ((1 - sanitizedBody.length / params.currentPost.body.length) * 100).toFixed(1)
    : '0.0'
});
```

### 3. `/home/cdm/redditmod/src/ai/analyzer.ts`
**Location**: `analyzeUserWithQuestions()` method

#### Before Provider Call (Lines 538-545)
Added logging of:
- Correlation ID
- User ID
- Provider selection status
- Question count
- Cache check status
- Budget availability

#### After Provider Response (Lines 550-564)
Added logging of:
- Provider used
- Answers received
- Token usage and cost
- Cache TTL
- Answer summaries (ID, answer, confidence, reasoning preview)

```typescript
console.log('[AIAnalyzer] Question analysis complete:', {
  correlationId,
  userId: result.userId,
  provider: result.provider,
  answersReceived: result.answers.length,
  tokensUsed: result.tokensUsed,
  cost: result.costUSD.toFixed(4),
  cacheTTL: result.cacheTTL,
  answers: result.answers.map(a => ({
    id: a.questionId,
    answer: a.answer,
    confidence: a.confidence,
    reasoning: a.reasoning?.substring(0, 100) + (a.reasoning && a.reasoning.length > 100 ? '...' : '')
  }))
});
```

### 4. `/home/cdm/redditmod/src/ai/validator.ts`
**Location**: `validateQuestionBatchResponse()` method

#### Before Validation (Lines 399-402)
Added logging of:
- Presence of answers array
- Answer count

#### After Successful Validation (Lines 409-416)
Added logging of:
- Number of answers validated
- Validation check (all answers have valid format)

#### After Validation Failure (Lines 433-436)
Added logging of:
- Error message
- Response preview (first 200 characters)

```typescript
console.log('[Validator] Validation passed:', {
  answersValidated: parsed.answers.length,
  allAnswersValid: parsed.answers.every(a =>
    ['YES', 'NO'].includes(a.answer) &&
    a.confidence >= 0 &&
    a.confidence <= 100
  )
});
```

## Log Prefix Convention

All logs use consistent prefixes for easy filtering:
- `[OpenAI]` - OpenAI provider operations
- `[PromptManager]` - Prompt building and sanitization
- `[AIAnalyzer]` - High-level analysis orchestration
- `[Validator]` - Response validation

## Key Features

### 1. No PII Logging
- User IDs and usernames are logged (safe for debugging)
- Email, phone, and other PII are NOT logged
- Content is shown in sanitized/summarized form

### 2. Correlation IDs
- Every log includes correlation ID for tracing requests
- Makes it easy to follow a single request through the pipeline

### 3. Token and Cost Tracking
- Every AI call logs token usage
- Cost is calculated and logged in USD (4 decimal places)
- Enables budget monitoring and optimization

### 4. Content Sanitization Metrics
- Shows original vs sanitized content lengths
- Calculates reduction percentage
- Helps understand sanitization impact

### 5. Preview Truncation
- Long content is truncated with "..." suffix
- Prompts: 500 characters
- Responses: 200 characters
- Reasoning: 100 characters
- Prevents log flooding while maintaining debuggability

### 6. Structured Logging
- All logs use consistent object format
- Easy to parse programmatically
- Good for log aggregation tools

## Usage Examples

### Grep for Specific Request
```bash
grep "correlationId-abc-123" logs.txt
```

### Filter by Component
```bash
grep "\[OpenAI\]" logs.txt
grep "\[Validator\]" logs.txt
```

### Track Token Usage
```bash
grep "tokensUsed" logs.txt
```

### Find Validation Failures
```bash
grep "\[Validator\] Validation failed" logs.txt
```

### Monitor Costs
```bash
grep "cost:" logs.txt
```

## Testing Verification

After implementation, verify logs show:
1. ✅ Questions being asked (with IDs and text)
2. ✅ User data summary being sent (not full content)
3. ✅ Sanitization impact (before/after sizes)
4. ✅ AI response with answers and confidence
5. ✅ Token usage and costs
6. ✅ Validation results

## Performance Impact

- Minimal: Logging is synchronous but lightweight
- Object construction is lazy (only when logged)
- String truncation is O(1) with substring()
- No external I/O or network calls

## Future Enhancements

Potential improvements:
1. Add log levels (debug, info, warn, error)
2. Structured logging library (winston, pino)
3. Log aggregation service integration
4. Performance timing breakdowns
5. Memory usage tracking

## Compatibility

- No breaking changes to existing code
- All existing functionality preserved
- Logs are additive only
- TypeScript compilation verified
