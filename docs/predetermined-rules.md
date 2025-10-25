# Predetermined Moderation Rules

This document outlines the pre-built moderation rules that will be included with the Reddit AI Automod app. These rules cover common moderation scenarios and can be enabled/configured per subreddit.

## Rule Categories

### 1. Content Quality Rules

#### 1.1 Spam Detection
**Purpose**: Identify and remove spam content

**Checks**:
- Excessive self-promotion links
- Repetitive content patterns
- Known spam domains
- Suspicious link shorteners
- Multiple posts of same content

**AI Analysis**: Analyzes post content for spam indicators

**Actions Available**:
- Report to mod queue
- Auto-remove (high confidence only)
- Add flair "Pending Review"
- Track user spam score

**Configuration**:
- Confidence threshold (default: 85%)
- Auto-remove threshold (default: 95%)
- Suspicious domains list
- Maximum self-promotion ratio

---

#### 1.2 Low-Effort Content
**Purpose**: Filter out low-quality submissions

**Checks**:
- Title-only posts (no body)
- Very short posts (< 50 characters)
- Single word comments
- "This" or "Same" type responses
- Excessive emoji usage

**AI Analysis**: Evaluates substantive content

**Actions Available**:
- Report to mod queue
- Auto-remove
- Request elaboration (auto-comment)
- Track user quality score

**Configuration**:
- Minimum post length (default: 50 chars)
- Minimum comment length (default: 10 chars)
- Emoji threshold (default: >30% of text)
- Exceptions for certain post types

---

#### 1.3 Duplicate Content
**Purpose**: Prevent reposting and duplicate submissions

**Checks**:
- Exact title matches (last 7 days)
- Similar content detection (>80% similarity)
- Same URL already posted
- User reposting own removed content

**AI Analysis**: Semantic similarity checking

**Actions Available**:
- Report to mod queue
- Auto-remove with explanation
- Direct user to original post
- Track repost frequency

**Configuration**:
- Time window (default: 7 days)
- Similarity threshold (default: 80%)
- Allow reposts by moderators
- Exceptions for megathread topics

---

### 2. User Safety Rules

#### 2.1 Harassment & Bullying
**Purpose**: Detect and prevent targeted harassment

**Checks**:
- Personal attacks
- Targeted insults
- Doxxing attempts
- Threats (explicit or veiled)
- Sustained targeting of specific users

**AI Analysis**: Context-aware harassment detection

**Actions Available**:
- Report to mod queue
- Auto-remove
- Issue warning to user
- Temporary mute
- Permanent ban (severe cases)

**Configuration**:
- Sensitivity level (low/medium/high)
- Auto-remove threshold (default: 90%)
- Warning vs. immediate action
- Track harassment history

---

#### 2.2 Hate Speech & Bigotry
**Purpose**: Remove discriminatory content

**Checks**:
- Slurs and derogatory terms
- Racist/sexist/homophobic content
- Religious intolerance
- Ableist language
- Dog whistles and coded language

**AI Analysis**: Context-aware hate speech detection

**Actions Available**:
- Auto-remove (high confidence)
- Report to mod queue
- Issue ban (configurable duration)
- Track hate speech patterns

**Configuration**:
- Zero-tolerance mode (default: on)
- Confidence threshold (default: 85%)
- Ban duration (default: permanent)
- Blocked terms list

---

#### 2.3 Sexual Content & NSFW
**Purpose**: Enforce NSFW policies

**Checks**:
- Sexual content in SFW subreddits
- Unsolicited NSFW content
- Sexualization of minors (zero tolerance)
- Pornographic material
- NSFW content without proper tagging

**AI Analysis**: Visual and text content analysis

**Actions Available**:
- Auto-remove immediately
- Permanent ban (severe violations)
- Report to Reddit admins
- Add NSFW flair (if allowed)

**Configuration**:
- Allow NSFW with flair (yes/no)
- Zero-tolerance categories
- Auto-report to admins (certain content)

---

#### 2.4 Violence & Gore
**Purpose**: Remove violent or disturbing content

**Checks**:
- Graphic violence
- Gore content
- Animal abuse
- Self-harm content
- Calls for violence

**AI Analysis**: Content severity analysis

**Actions Available**:
- Auto-remove immediately
- Report to Reddit admins
- Issue warning or ban
- Offer crisis resources (self-harm)

**Configuration**:
- Violence tolerance level
- Auto-report threshold
- Crisis resource auto-reply

---

### 3. Community Standards Rules

#### 3.1 Off-Topic Content
**Purpose**: Keep submissions relevant to subreddit

**Checks**:
- Topic relevance analysis
- Subreddit category mismatch
- Better-suited subreddit suggestions
- Karma farming attempts

**AI Analysis**: Topic classification and relevance scoring

**Actions Available**:
- Report to mod queue
- Auto-remove with explanation
- Suggest alternative subreddits
- Allow if community engages

**Configuration**:
- Relevance threshold (default: 70%)
- Auto-suggest alternatives
- Exception for meta discussions
- Moderator discretion mode

---

#### 3.2 Civility & Tone
**Purpose**: Maintain respectful discourse

**Checks**:
- Aggressive language
- Excessive profanity
- Hostile tone
- Bad faith arguments
- Trolling behavior

**AI Analysis**: Tone and sentiment analysis

**Actions Available**:
- Issue warning comment
- Remove comment
- Temporary timeout
- Track civility score

**Configuration**:
- Profanity tolerance (none/low/medium)
- Warning before removal
- Timeout duration (default: 24h)
- Exception for quotes/discussion

---

#### 3.3 Self-Promotion Limits
**Purpose**: Prevent spam while allowing reasonable self-promotion

**Checks**:
- User post history (self-promotion ratio)
- Account age requirements
- Karma requirements
- Frequency of promotional posts
- Engagement with community

**AI Analysis**: Pattern detection across user history

**Actions Available**:
- Report to mod queue
- Auto-remove with explanation
- Require karma threshold
- Allow after community participation

**Configuration**:
- Self-promotion ratio (default: 10% max)
- Minimum account age (default: 30 days)
- Minimum karma (default: 100)
- Cooldown period (default: 7 days)

---

### 4. New User Protection Rules

#### 4.1 New Account Restrictions
**Purpose**: Reduce spam from throwaway accounts

**Checks**:
- Account age < threshold
- Very low karma
- No post history
- Name pattern matching (spam bots)

**AI Analysis**: Bot likelihood scoring

**Actions Available**:
- Auto-remove with explanation
- Send to mod queue for approval
- Auto-approve after verification
- Message user with requirements

**Configuration**:
- Minimum account age (default: 7 days)
- Minimum karma (default: 10)
- Exempt established contributors
- Welcome message option

---

#### 4.2 Karma Requirements
**Purpose**: Ensure users are engaged Redditors

**Checks**:
- Total karma below threshold
- Subreddit karma below threshold
- Negative karma (potential troll)
- Karma farming patterns

**AI Analysis**: User engagement patterns

**Actions Available**:
- Filter to mod queue
- Auto-remove with explanation
- Require introduction post
- Gradually increase access

**Configuration**:
- Minimum total karma (default: 50)
- Minimum subreddit karma (default: 10)
- Negative karma threshold
- Grace period for new users

---

### 5. Link & Domain Rules

#### 5.1 Domain Filtering
**Purpose**: Block known problematic domains

**Checks**:
- Blacklisted domains
- Suspicious/new domains
- Link shorteners
- Affiliate links
- Phishing attempts

**AI Analysis**: Domain reputation scoring

**Actions Available**:
- Auto-remove blacklisted
- Report suspicious domains
- Allow whitelisted domains
- Track domain usage

**Configuration**:
- Blacklist (customizable)
- Whitelist (customizable)
- Allow link shorteners (yes/no)
- Auto-expand shortened links

---

#### 5.2 Brigading Prevention
**Purpose**: Detect coordinated voting/posting

**Checks**:
- Sudden influx from specific source
- Coordinated voting patterns
- New users from same subreddit
- Crosspost monitoring

**AI Analysis**: Timing and pattern analysis

**Actions Available**:
- Lock thread
- Report to admins
- Filter new participants
- Notify moderators

**Configuration**:
- Influx threshold (default: 50+ new users/hour)
- Lock after threshold
- Filter mode (strict/moderate/off)
- Whitelist partner subreddits

---

### 6. Format & Compliance Rules

#### 6.1 Post Formatting Requirements
**Purpose**: Ensure posts follow subreddit format

**Checks**:
- Required flair present
- Title format compliance
- Minimum/maximum length
- Required tags (e.g., [Serious])
- File type requirements

**AI Analysis**: Format pattern matching

**Actions Available**:
- Auto-remove with format instructions
- Auto-apply appropriate flair
- Request corrections
- Allow after edit

**Configuration**:
- Required flair categories
- Title format regex
- Length requirements
- Auto-flair keywords

---

#### 6.2 Citation & Source Requirements
**Purpose**: Require credible sources for claims

**Checks**:
- Claims without sources
- Misinformation flags
- Required citations missing
- Source quality assessment

**AI Analysis**: Fact-checking and source evaluation

**Actions Available**:
- Request source in comment
- Report if no response
- Remove unsubstantiated claims
- Allow with disclaimer

**Configuration**:
- Source requirement level
- Grace period for providing source
- Trusted source whitelist
- Disclaimer templates

---

## Rule Presets by Community Type

### News/Politics Subreddits
- Civility & Tone (strict)
- Citation & Source Requirements (required)
- Hate Speech & Bigotry (zero tolerance)
- Duplicate Content (7-day window)

### Support/Advice Subreddits
- Harassment & Bullying (zero tolerance)
- Violence & Self-Harm (with resources)
- New User Protection (relaxed)
- Civility & Tone (moderate)

### Creative/Sharing Subreddits
- Self-Promotion Limits (moderate)
- Off-Topic Content (relaxed)
- Spam Detection (moderate)
- Low-Effort Content (relaxed)

### Discussion/Debate Subreddits
- Civility & Tone (moderate)
- Bad Faith Arguments (strict)
- Off-Topic Content (moderate)
- Source Requirements (encouraged)

### Meme/Humor Subreddits
- Duplicate Content (strict)
- Spam Detection (moderate)
- Low-Effort Content (relaxed)
- Off-Topic Content (moderate)

---

## Custom Rule Builder

In addition to predetermined rules, moderators can create custom rules with:

### Custom Rule Components

1. **Trigger Conditions**
   - Post/Comment submission
   - Edit events
   - Report threshold
   - Keyword matching
   - Pattern matching

2. **Filters**
   - User attributes (karma, age, history)
   - Content attributes (length, format, media type)
   - Context (time of day, day of week)
   - Engagement metrics (votes, comments)

3. **AI Analysis Options**
   - Toxicity scoring
   - Sentiment analysis
   - Topic classification
   - Intent detection
   - Custom prompt analysis

4. **Action Options**
   - Remove/Approve
   - Report to queue
   - Auto-comment (template)
   - User warning/timeout/ban
   - Add/Remove flair
   - Lock thread
   - Sticky comment
   - Send modmail
   - Log to database

5. **Configuration**
   - Confidence thresholds
   - Cooldown periods
   - Exception lists
   - Time windows
   - Action escalation

---

## Rule Testing & Tuning

### Test Mode
- Dry-run mode (log only, no actions)
- Preview mode (show what would happen)
- A/B testing (compare rule versions)
- Rollback capability

### Monitoring Dashboard
- Rule trigger frequency
- False positive rate
- Action distribution
- User feedback
- Mod override frequency

### Feedback Loop
- Moderator review of flagged content
- User appeals
- Confidence score adjustment
- Rule refinement suggestions
- Community feedback integration

---

## Implementation Priority

### Phase 1 (MVP)
1. Spam Detection
2. Hate Speech & Bigotry
3. Harassment & Bullying
4. New Account Restrictions
5. Basic Custom Rules

### Phase 2
6. Low-Effort Content
7. Duplicate Content
8. Self-Promotion Limits
9. Domain Filtering
10. Civility & Tone

### Phase 3
11. Off-Topic Content
12. Format Requirements
13. Citation Requirements
14. Violence & Gore
15. Brigading Prevention

### Phase 4
16. Advanced Custom Rules
17. Rule Presets
18. A/B Testing
19. ML Model Training
20. Community-Specific Tuning

---

## Notes

- All rules have confidence thresholds to minimize false positives
- Moderators can override any automated action
- All actions are logged for audit and appeal
- Rules can be enabled/disabled per subreddit
- Configuration is stored in Redis per community
- AI models can be customized per subreddit needs
