# Reddit Automod Implementation Guide

Practical guide for implementing content moderation using OpenAI, Gemini, and Claude APIs.

---

## Quick Start: 5-Minute Setup

### Install Dependencies

```bash
pip install openai anthropic google-generativeai python-dotenv
```

### Environment Setup

Create `.env`:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

Load in Python:
```python
import os
from dotenv import load_dotenv

load_dotenv()
openai_key = os.getenv("OPENAI_API_KEY")
anthropic_key = os.getenv("ANTHROPIC_API_KEY")
google_key = os.getenv("GOOGLE_API_KEY")
```

---

## 1. OpenAI Moderation API (FREE - Start Here)

### 1.1 Basic Setup

```python
import openai
from openai import OpenAI

client = OpenAI(api_key=openai_key)

def check_content_openai(text: str) -> dict:
    """Use OpenAI's FREE Moderation API"""
    response = client.moderations.create(input=text)

    result = response.results[0]

    return {
        "flagged": result.flagged,
        "categories": result.category_scores,
        "violations": {
            cat: score
            for cat, score in result.category_scores.items()
            if score > 0.5  # Only show >50% confidence
        }
    }

# Test it
content = "I'm going to beat you up after the game tomorrow"
result = check_content_openai(content)
print(result)
```

### 1.2 Production-Ready Implementation

```python
import openai
import json
from typing import Literal
from dataclasses import dataclass

@dataclass
class ModerationDecision:
    action: Literal["allow", "flag", "remove"]
    confidence: float
    categories: dict
    explanation: str
    api_used: str

class RedditModerator:
    """Production-ready moderation system"""

    # Thresholds (adjust based on your needs)
    REMOVE_THRESHOLD = 0.75  # >75% confidence = auto-remove
    FLAG_THRESHOLD = 0.50    # 50-75% = flag for review
    ALLOW_THRESHOLD = 0.50   # <50% = allow

    def __init__(self, openai_api_key: str, anthropic_api_key: str):
        self.openai = OpenAI(api_key=openai_api_key)
        self.openai_key = openai_api_key
        self.anthropic_key = anthropic_api_key

    def _format_content(self, title: str, body: str) -> str:
        """Format Reddit post for moderation"""
        return f"Title: {title}\n\nBody: {body}".strip()

    def stage1_moderation(self, title: str, body: str) -> ModerationDecision:
        """
        Stage 1: Fast, free OpenAI Moderation API
        Catches ~95% of violations
        """
        content = self._format_content(title, body)

        try:
            response = self.openai.moderations.create(input=content)
            result = response.results[0]

            # Get max category score
            max_score = max(result.category_scores.values())
            flagged_categories = {
                cat: score
                for cat, score in result.category_scores.items()
                if score > 0.3
            }

            # Decide action
            if max_score > self.REMOVE_THRESHOLD:
                action = "remove"
                explanation = f"High confidence violation: {max(flagged_categories.items(), key=lambda x: x[1])[0]}"
            elif max_score > self.FLAG_THRESHOLD:
                action = "flag"
                explanation = "Potential violation - flagged for review"
            else:
                action = "allow"
                explanation = "No violations detected"

            return ModerationDecision(
                action=action,
                confidence=max_score,
                categories=flagged_categories,
                explanation=explanation,
                api_used="openai_moderation"
            )

        except openai.RateLimitError:
            # Fallback: flag for manual review if rate limited
            return ModerationDecision(
                action="flag",
                confidence=0.0,
                categories={},
                explanation="API rate limit - flagged for manual review",
                api_used="openai_moderation_error"
            )

# Usage
moderator = RedditModerator(openai_key, anthropic_key)

title = "Best gaming setup"
body = "Check out my new gaming PC build!"

decision = moderator.stage1_moderation(title, body)
print(f"Action: {decision.action}")
print(f"Confidence: {decision.confidence:.2%}")
print(f"Explanation: {decision.explanation}")
```

---

## 2. Anthropic Claude Implementation

### 2.1 Basic Setup

```python
from anthropic import Anthropic

client = Anthropic()

def moderate_with_claude(title: str, body: str) -> dict:
    """Analyze content with Claude"""

    system_prompt = """You are a Reddit content moderator. Analyze posts for policy violations.

Categories to check:
- Hate speech: slurs, dehumanizing language
- Harassment: targeting individuals, threats
- Violence: threats, graphic violence
- Self-harm: encouraging self-injury
- Sexual: explicit content
- Spam: platform manipulation

Respond with JSON:
{
  "violation": boolean,
  "categories": {"category": bool, ...},
  "severity": "none" | "low" | "medium" | "high",
  "confidence": 0.0-1.0,
  "explanation": "brief reason"
}
"""

    message = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=200,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": f"Title: {title}\n\nBody: {body}"
        }]
    )

    # Parse JSON response
    import json
    response_text = message.content[0].text
    return json.loads(response_text)

# Test
result = moderate_with_claude("Gaming post", "Check out my setup")
print(result)
```

### 2.2 Claude with Prompt Caching

```python
from anthropic import Anthropic
import json

class ClaudeModeratorWithCaching:
    """Claude with prompt caching for cost optimization"""

    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)

        # This gets cached (90% cost savings on repeated requests)
        self.SYSTEM_PROMPT = """You are a Reddit content moderator.

Moderation categories and definitions:
1. Hate Speech: Slurs, dehumanizing comparisons, ethnic/religious attacks
2. Harassment: Direct threats, targeting individuals, doxxing
3. Violence: Threats of violence, glorification of violence
4. Self-harm: Encouraging self-injury, suicide, eating disorders
5. Sexual Content: Explicit sexual material, sexual harassment
6. Spam: Platform manipulation, brigading, spam links
7. Misinformation: False health/election claims causing direct harm

For each category, determine if violated (true/false) and confidence (0.0-1.0).

Return ONLY valid JSON matching this schema:
{
  "violations": {
    "hate_speech": {"violated": bool, "confidence": float},
    "harassment": {"violated": bool, "confidence": float},
    "violence": {"violated": bool, "confidence": float},
    "self_harm": {"violated": bool, "confidence": float},
    "sexual": {"violated": bool, "confidence": float},
    "spam": {"violated": bool, "confidence": float},
    "misinformation": {"violated": bool, "confidence": float}
  },
  "severity": "none" | "low" | "medium" | "high",
  "recommendation": "allow" | "flag" | "remove",
  "explanation": "brief reason",
  "confidence": 0.0-1.0
}"""

    def moderate(self, title: str, body: str, subreddit: str = "general") -> dict:
        """Moderate content with caching enabled"""

        response = self.client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=300,
            system=[
                {
                    "type": "text",
                    "text": self.SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"}  # Cache for 5 minutes
                }
            ],
            messages=[{
                "role": "user",
                "content": f"""Subreddit: r/{subreddit}

Title: {title}

Body: {body}"""
            }]
        )

        # Parse response
        response_text = response.content[0].text
        result = json.loads(response_text)

        # Add usage info for cost tracking
        result["usage"] = {
            "input_tokens": response.usage.input_tokens,
            "cache_creation_input_tokens": getattr(response.usage, 'cache_creation_input_tokens', 0),
            "cache_read_input_tokens": getattr(response.usage, 'cache_read_input_tokens', 0),
            "output_tokens": response.usage.output_tokens
        }

        return result

# Usage with caching
moderator = ClaudeModeratorWithCaching(anthropic_key)

# First request: creates cache (normal price)
result1 = moderator.moderate(
    title="Gaming setup guide",
    body="Here's how I built my PC...",
    subreddit="gaming"
)
print(f"Request 1 - Cache created: {result1['usage']['cache_creation_input_tokens']} tokens")

# Second request: uses cached system prompt (90% discount on those tokens!)
result2 = moderator.moderate(
    title="Another gaming post",
    body="My new build...",
    subreddit="gaming"
)
print(f"Request 2 - Cache read: {result2['usage']['cache_read_input_tokens']} tokens (90% savings)")
```

### 2.3 Claude Batch API for High Volume

```python
from anthropic import Anthropic
import json
import time

class BatchModerator:
    """Process large batches of posts asynchronously with 50% discount"""

    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)

    def create_batch(self, posts: list) -> str:
        """
        Submit batch of posts for processing
        - Cost: 50% discount
        - Processing: Within 24 hours
        - Max: 100,000 requests per batch
        """

        requests = []
        for i, post in enumerate(posts):
            requests.append({
                "custom_id": post["id"],
                "params": {
                    "model": "claude-3-5-haiku-20241022",
                    "max_tokens": 300,
                    "system": "You are a Reddit moderator. Return JSON with: violation (bool), severity (str), recommendation (str), explanation (str).",
                    "messages": [{
                        "role": "user",
                        "content": f"Title: {post['title']}\n\nBody: {post['body']}"
                    }]
                }
            })

        # Submit batch
        batch = self.client.beta.messages.batches.create(requests=requests)

        print(f"Batch {batch.id} submitted")
        print(f"Request count: {len(requests)}")
        print(f"Cost savings: ~50% vs real-time API")
        print(f"Processing time: Within 24 hours")

        return batch.id

    def check_batch_status(self, batch_id: str) -> dict:
        """Check batch processing status"""
        batch = self.client.beta.messages.batches.retrieve(batch_id)

        return {
            "id": batch.id,
            "status": batch.processing_status,  # queued, processing, succeeded, failed
            "request_counts": {
                "processing": batch.request_counts.processing,
                "succeeded": batch.request_counts.succeeded,
                "errored": batch.request_counts.errored
            }
        }

    def get_batch_results(self, batch_id: str) -> list:
        """Retrieve completed batch results"""
        batch = self.client.beta.messages.batches.retrieve(batch_id)

        if batch.processing_status != "succeeded":
            print(f"Batch status: {batch.processing_status}")
            return []

        results = []
        for result in self.client.beta.messages.batches.results(batch_id):
            results.append({
                "post_id": result.custom_id,
                "decision": json.loads(result.result.message.content[0].text)
            })

        return results

# Usage
batch_moderator = BatchModerator(anthropic_key)

# Submit 5000 posts for overnight processing
posts = [
    {"id": f"post_{i}", "title": f"Post {i}", "body": f"Content {i}"}
    for i in range(5000)
]

batch_id = batch_moderator.create_batch(posts)

# Later, check status
status = batch_moderator.check_batch_status(batch_id)
print(f"Status: {status['status']}")

# When complete, get results
if status['status'] == 'succeeded':
    results = batch_moderator.get_batch_results(batch_id)
    print(f"Processed {len(results)} posts")
```

---

## 3. Google Gemini Implementation

### 3.1 Basic Setup

```python
import google.generativeai as genai
import json

def moderate_with_gemini(title: str, body: str) -> dict:
    """Analyze content with Gemini Flash"""

    genai.configure(api_key=google_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = f"""Analyze this Reddit post for content policy violations.

Title: {title}
Body: {body}

Return JSON:
{{
  "violation": boolean,
  "categories": {{
    "hate_speech": boolean,
    "harassment": boolean,
    "violence": boolean,
    "sexual": boolean,
    "self_harm": boolean,
    "misinformation": boolean,
    "spam": boolean
  }},
  "severity": "none" | "low" | "medium" | "high",
  "confidence": 0.0-1.0,
  "recommendation": "allow" | "flag" | "remove",
  "explanation": "brief reason"
}}

Return ONLY valid JSON, no markdown."""

    response = model.generate_content(prompt)

    # Extract JSON from response
    text = response.text
    if text.startswith("```json"):
        text = text[7:-3]  # Remove markdown code blocks if present

    return json.loads(text)

# Test
result = moderate_with_gemini("Title", "Body")
print(result)
```

### 3.2 Gemini with Batch Processing

```python
import google.generativeai as genai
import json
import time

class GeminiBatchModerator:
    """Gemini with 50% batch discount"""

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    def batch_moderate(self, posts: list) -> dict:
        """
        Process multiple posts
        Note: Gemini doesn't have official batch API like Claude
        But you can submit requests in rapid succession
        """

        results = []

        for post in posts:
            prompt = f"""Analyze Reddit post:
Title: {post['title']}
Body: {post['body']}

Return JSON with: violation, categories, severity, confidence, recommendation, explanation."""

            response = self.model.generate_content(prompt)

            try:
                decision = json.loads(response.text)
                results.append({
                    "post_id": post["id"],
                    "decision": decision,
                    "tokens_used": response.usage_metadata.output_token_count
                })
            except json.JSONDecodeError:
                results.append({
                    "post_id": post["id"],
                    "error": "Failed to parse response"
                })

            # Respect rate limits
            time.sleep(0.1)  # 100ms between requests

        return results

# Usage
gemini_moderator = GeminiBatchModerator(google_key)

posts = [
    {"id": "1", "title": "Gaming post", "body": "Check out my setup"},
    {"id": "2", "title": "Another post", "body": "More content"}
]

results = gemini_moderator.batch_moderate(posts)
```

---

## 4. Hybrid Approach (Recommended)

### 4.1 Production System

```python
import openai
from anthropic import Anthropic
import json
from enum import Enum
from typing import Optional
from dataclasses import dataclass

class ModerationAction(str, Enum):
    ALLOW = "allow"
    FLAG = "flag"
    REMOVE = "remove"

@dataclass
class ModerationResult:
    action: ModerationAction
    confidence: float
    stage: str  # which API made the decision
    explanation: str
    categories: dict
    tokens_used: int = 0
    cost_estimate: float = 0.0

class HybridRedditModerator:
    """
    Two-stage moderation system:
    1. Fast/Free (OpenAI Moderation API) - 95% of posts
    2. Detailed (Claude Haiku) - Edge cases/appeals
    """

    def __init__(self, openai_key: str, anthropic_key: str):
        self.openai = openai.OpenAI(api_key=openai_key)
        self.anthropic = Anthropic(api_key=anthropic_key)

    def moderate(
        self,
        title: str,
        body: str,
        subreddit: str = "general",
        force_detailed: bool = False
    ) -> ModerationResult:
        """
        Moderate post with two-stage approach
        """

        content = f"{title}\n\n{body}"

        # Stage 1: OpenAI Moderation API (FREE)
        if not force_detailed:
            stage1_result = self._stage1_moderation(content)

            # If high confidence, return decision
            if stage1_result.action == ModerationAction.REMOVE:
                return stage1_result

            # If low confidence, allow
            if stage1_result.action == ModerationAction.ALLOW:
                return stage1_result

        # Stage 2: Claude for uncertain cases (PAID but cheap)
        stage2_result = self._stage2_detailed_analysis(
            title, body, subreddit, stage1_result if not force_detailed else None
        )

        return stage2_result

    def _stage1_moderation(self, content: str) -> ModerationResult:
        """Fast, free OpenAI Moderation API"""

        response = self.openai.moderations.create(input=content)
        result = response.results[0]

        # Find max score and category
        max_score = max(result.category_scores.values())
        max_category = max(result.category_scores.items(), key=lambda x: x[1])

        flagged_categories = {
            cat: score for cat, score in result.category_scores.items()
            if score > 0.3
        }

        # Determine action
        if max_score > 0.75:
            action = ModerationAction.REMOVE
            explanation = f"High confidence {max_category[0]}"
        elif max_score > 0.50:
            action = ModerationAction.FLAG
            explanation = "Moderate confidence - needs review"
        else:
            action = ModerationAction.ALLOW
            explanation = "Low violation probability"

        return ModerationResult(
            action=action,
            confidence=max_score,
            stage="openai_moderation",
            explanation=explanation,
            categories=flagged_categories,
            tokens_used=0,
            cost_estimate=0.0
        )

    def _stage2_detailed_analysis(
        self,
        title: str,
        body: str,
        subreddit: str,
        stage1_result: Optional[ModerationResult] = None
    ) -> ModerationResult:
        """Detailed analysis with Claude"""

        system_prompt = """You are a Reddit moderator. Analyze content thoroughly.

Return JSON:
{
  "violation": boolean,
  "severity": "none" | "low" | "medium" | "high",
  "recommendation": "allow" | "flag" | "remove",
  "confidence": 0.0-1.0,
  "explanation": "brief reason",
  "categories": {"category": boolean}
}"""

        user_message = f"""Subreddit: r/{subreddit}

Title: {title}

Body: {body}"""

        if stage1_result:
            user_message += f"\n\nStage 1 flags: {stage1_result.categories}"

        message = self.anthropic.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=200,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}]
        )

        # Parse response
        response_text = message.content[0].text
        decision = json.loads(response_text)

        # Convert recommendation to action
        action = ModerationAction(decision["recommendation"])

        # Calculate cost
        # Haiku: $1/$5 per 1M tokens
        input_tokens = message.usage.input_tokens
        output_tokens = message.usage.output_tokens
        total_tokens = input_tokens + output_tokens

        # ~$0.006 per 1M tokens (simplified)
        cost = (total_tokens / 1_000_000) * 6

        return ModerationResult(
            action=action,
            confidence=decision["confidence"],
            stage="claude_haiku",
            explanation=decision["explanation"],
            categories=decision["categories"],
            tokens_used=total_tokens,
            cost_estimate=cost
        )

# Usage
moderator = HybridRedditModerator(openai_key, anthropic_key)

# Example 1: Clear violation (stops at stage 1)
result1 = moderator.moderate(
    title="I hate all [group]",
    body="Kill them",
    subreddit="politics"
)
print(f"Example 1: {result1.action.value} (confidence: {result1.confidence:.1%})")
print(f"  Stage: {result1.stage} | Cost: ${result1.cost_estimate:.4f}")

# Example 2: Ambiguous case (goes to stage 2)
result2 = moderator.moderate(
    title="You got destroyed",
    body="That argument was terrible",
    subreddit="debate"
)
print(f"\nExample 2: {result2.action.value} (confidence: {result2.confidence:.1%})")
print(f"  Stage: {result2.stage} | Cost: ${result2.cost_estimate:.4f}")

# Example 3: Force detailed analysis (appeals)
result3 = moderator.moderate(
    title="You got destroyed",
    body="That argument was terrible",
    subreddit="debate",
    force_detailed=True
)
print(f"\nExample 3 (appeal): {result3.action.value}")
```

---

## 5. Monitoring & Cost Tracking

### 5.1 Cost Tracking System

```python
from dataclasses import dataclass
from datetime import datetime
import json

@dataclass
class ModerationStats:
    total_processed: int = 0
    auto_allowed: int = 0
    auto_flagged: int = 0
    auto_removed: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    openai_calls: int = 0
    claude_calls: int = 0

    def add_result(self, result: ModerationResult):
        self.total_processed += 1

        if result.action == ModerationAction.ALLOW:
            self.auto_allowed += 1
        elif result.action == ModerationAction.FLAG:
            self.auto_flagged += 1
        else:  # REMOVE
            self.auto_removed += 1

        self.total_tokens += result.tokens_used
        self.total_cost += result.cost_estimate

        if "openai" in result.stage:
            self.openai_calls += 1
        elif "claude" in result.stage:
            self.claude_calls += 1

    def get_stats(self) -> dict:
        return {
            "total_processed": self.total_processed,
            "breakdown": {
                "allowed": self.auto_allowed,
                "flagged": self.auto_flagged,
                "removed": self.auto_removed
            },
            "api_usage": {
                "openai_calls": self.openai_calls,
                "claude_calls": self.claude_calls,
                "total_tokens": self.total_tokens
            },
            "cost": {
                "total": f"${self.total_cost:.4f}",
                "per_item": f"${self.total_cost / max(self.total_processed, 1):.6f}"
            }
        }

# Usage
stats = ModerationStats()

# After processing items
results = [...]  # your moderation results

for result in results:
    stats.add_result(result)

print(json.dumps(stats.get_stats(), indent=2))
```

### 5.2 Accuracy Tracking

```python
class AccuracyTracker:
    """Track moderation accuracy vs human reviews"""

    def __init__(self):
        self.correct = 0
        self.incorrect = 0
        self.undecided = 0
        self.decisions_by_confidence = {}

    def record_human_review(self, ai_decision: ModerationAction, human_decision: ModerationAction, confidence: float):
        """Compare AI decision to human moderator decision"""

        is_correct = ai_decision == human_decision

        if is_correct:
            self.correct += 1
        else:
            self.incorrect += 1

        # Track accuracy by confidence level
        confidence_bucket = int(confidence * 10) / 10  # Round to nearest 0.1

        if confidence_bucket not in self.decisions_by_confidence:
            self.decisions_by_confidence[confidence_bucket] = {"correct": 0, "incorrect": 0}

        if is_correct:
            self.decisions_by_confidence[confidence_bucket]["correct"] += 1
        else:
            self.decisions_by_confidence[confidence_bucket]["incorrect"] += 1

    def get_accuracy_report(self) -> dict:
        total = self.correct + self.incorrect

        accuracy_by_confidence = {}
        for confidence, counts in sorted(self.decisions_by_confidence.items()):
            total_at_confidence = counts["correct"] + counts["incorrect"]
            if total_at_confidence > 0:
                accuracy_at_confidence = counts["correct"] / total_at_confidence
                accuracy_by_confidence[f"{confidence:.1%}"] = f"{accuracy_at_confidence:.1%}"

        return {
            "overall_accuracy": f"{self.correct / max(total, 1):.1%}",
            "total_reviews": total,
            "correct": self.correct,
            "incorrect": self.incorrect,
            "accuracy_by_confidence": accuracy_by_confidence
        }

# Usage
tracker = AccuracyTracker()

# As humans review moderation decisions
tracker.record_human_review(ModerationAction.REMOVE, ModerationAction.REMOVE, confidence=0.92)
tracker.record_human_review(ModerationAction.ALLOW, ModerationAction.ALLOW, confidence=0.15)
tracker.record_human_review(ModerationAction.FLAG, ModerationAction.REMOVE, confidence=0.58)

report = tracker.get_accuracy_report()
print(json.dumps(report, indent=2))
```

---

## 6. Testing & Validation

### 6.1 Test Cases

```python
# Test cases covering different scenarios
test_cases = [
    # Clear violations
    {
        "title": "I hate [group]",
        "body": "All [group] should die",
        "expected": ModerationAction.REMOVE,
        "category": "hate_speech"
    },
    {
        "title": "Come to my house",
        "body": "I'll beat you up",
        "expected": ModerationAction.REMOVE,
        "category": "violence"
    },

    # Edge cases
    {
        "title": "You destroyed in that debate",
        "body": "That argument was killed",
        "expected": ModerationAction.ALLOW,
        "category": "none",
        "note": "Metaphorical language, not violence"
    },
    {
        "title": "Movie review",
        "body": "This scene shows brutal violence",
        "expected": ModerationAction.ALLOW,
        "category": "none",
        "note": "Describing content, not glorifying"
    },

    # Ambiguous
    {
        "title": "Hot take",
        "body": "[Group] members tend to...",
        "expected": ModerationAction.FLAG,
        "category": "potential_stereotype"
    },
]

def run_tests(moderator, test_cases):
    """Run test cases and report results"""

    passed = 0
    failed = 0

    for test in test_cases:
        result = moderator.moderate(test["title"], test["body"])

        is_pass = result.action == test["expected"]

        if is_pass:
            passed += 1
            status = "PASS"
        else:
            failed += 1
            status = "FAIL"

        print(f"[{status}] {test['title'][:30]}...")
        if not is_pass:
            print(f"  Expected: {test['expected'].value}, Got: {result.action.value}")
            print(f"  Confidence: {result.confidence:.1%}")

    print(f"\nResults: {passed} passed, {failed} failed ({passed/(passed+failed):.0%})")

# Run tests
moderator = HybridRedditModerator(openai_key, anthropic_key)
run_tests(moderator, test_cases)
```

---

## 7. Deployment Checklist

Before going live with automated moderation:

- [ ] Set up logging and monitoring
- [ ] Configure alert thresholds
- [ ] Run accuracy tests (aim for >90%)
- [ ] Set up human review queue for flagged items
- [ ] Configure rate limiting
- [ ] Set up cost tracking and budgets
- [ ] Create appeal process
- [ ] Document decision-making logic
- [ ] Set up A/B testing for improvements
- [ ] Train moderators on system
- [ ] Create runbooks for common issues
- [ ] Set up gradual rollout (start at 50%)
- [ ] Monitor false positive/negative rates
- [ ] Adjust thresholds based on results

---

## Summary

**Recommended approach for Reddit automod:**

1. **Always start with**: OpenAI Moderation API (FREE)
2. **For edge cases**: Claude Haiku with prompt caching (CHEAP)
3. **For appeals**: Human moderators with Claude Sonnet (ACCURATE)
4. **For high volume**: Batch processing with 50% discount (ECONOMICAL)

**Expected monthly cost**: $0-50 depending on volume and accuracy targets
