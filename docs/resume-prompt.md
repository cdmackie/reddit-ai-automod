# Resume Prompt

## Quick Context
Reddit AI Automod is a Devvit-based moderation tool that uses AI (OpenAI + Gemini) to automate content moderation with both predetermined and custom rules. Built with TypeScript, Redis storage, and a hybrid two-stage AI strategy for cost efficiency.

**Stack**: Reddit Devvit (TypeScript), Redis, OpenAI API, Google Gemini API
**Current Phase**: Phase 0 - Planning (Complete)

---

## What's Been Done

### Planning & Documentation (Complete)
- ✅ Created comprehensive development workflow guide (CLAUDE.md)
- ✅ Researched Reddit Devvit platform capabilities and limitations
- ✅ Researched OpenAI and Gemini API integration strategies
- ✅ Documented 20 predetermined moderation rules across 6 categories
- ✅ Designed custom rule configuration system with full UI mockups
- ✅ Created detailed system architecture document
- ✅ Created 6-phase implementation plan (6-8 weeks total)
- ✅ Initialized project status tracking
- ✅ Created this resume prompt for session continuity

---

## Current State

**Status**: Planning complete, awaiting user approval to begin implementation

**What Exists**:
- `/home/cdm/redditmod/CLAUDE.md` - Development best practices
- `/home/cdm/redditmod/docs/` - All planning documents
  - `predetermined-rules.md` - 20 pre-built moderation rules
  - `custom-rule-system.md` - Custom rule builder design
  - `architecture.md` - Complete technical architecture
  - `implementation-plan.md` - 6-phase development plan
  - `project-status.md` - Current project status
  - `resume-prompt.md` - This file

**What Doesn't Exist Yet**:
- Git repository (not initialized)
- Devvit app (not created)
- Any source code
- Test subreddit (not created)
- Reddit app credentials (not registered)

---

## What's Next

### Immediate Next Steps (Awaiting User Approval)
1. **User reviews implementation plan**
2. **User approves technology stack and approach**
3. **User confirms budget and timeline acceptable**
4. **Initialize git repository** with proper .gitignore
5. **First commit**: Planning documents

### After Approval: Phase 1 Kickoff
1. Install Node.js 22.2.0+ (if not already installed)
2. Install Devvit CLI: `npm install -g devvit`
3. Create new Devvit app: `npm create devvit@latest`
4. Create test subreddit (< 200 members for beta testing)
5. Register Reddit app at https://www.reddit.com/prefs/apps
6. Set up project structure per architecture.md
7. Implement basic event handlers (PostSubmit, CommentSubmit)
8. Set up Redis storage abstraction layer
9. Deploy to test subreddit
10. Verify events trigger correctly

---

## Important Decisions

### Platform Choice
**Decision**: Reddit Devvit (TypeScript-based)
**Why**: Native integration, free hosting, built-in Redis, event-driven, eligible for $$ Reddit Developer Funds 2025

### AI Strategy
**Decision**: Hybrid two-stage approach
- **Stage 1**: OpenAI Moderation API (free forever, 85-90% accuracy)
- **Stage 2**: GPT-4/Gemini for edge cases (95%+ accuracy)
**Why**: Minimize costs ($0-50/month for 10k posts/day) while maintaining high accuracy

### Rule System
**Decision**: Both predetermined (20 rules) and custom rules
**Why**: Predetermined covers 80% of use cases; custom allows flexibility without coding

### Development Workflow
**Decision**: Follow 9-step mandatory workflow (Plan → Implement → Review → Test → Fix → Document → Commit → Report)
**Why**: Quality gates ensure production-ready code; documentation ensures session continuity

---

## Key Files

### Development Guide
- `CLAUDE.md`: Complete development practices and workflow (CRITICAL - read first each session)

### Planning Documents
- `docs/predetermined-rules.md`: 20 pre-built rules (spam, hate speech, harassment, etc.)
- `docs/custom-rule-system.md`: Custom rule builder design with UI mockups
- `docs/architecture.md`: Complete system architecture, data flow, component design
- `docs/implementation-plan.md`: 6-phase plan with tasks and acceptance criteria
- `docs/project-status.md`: Current status, completed tasks, next steps (UPDATE AFTER EVERY TASK!)
- `docs/resume-prompt.md`: This file (UPDATE AFTER EVERY TASK!)

### Source Code (Not Created Yet)
- `src/main.tsx`: Entry point (to be created)
- `src/handlers/`: Event handlers (to be created)
- `src/rules/`: Rule engine (to be created)
- `src/ai/`: AI providers (to be created)
- `src/storage/`: Redis layer (to be created)

---

## Architecture Highlights

### System Components
1. **Event Handler Layer**: Receive Reddit events (PostSubmit, CommentSubmit, etc.)
2. **Rule Engine Core**: Match, evaluate, prioritize rules
3. **Content Analysis Layer**: Keywords, regex, links, user history, similarity
4. **AI Analysis Layer**: Provider router (OpenAI/Gemini), prompt templates, caching
5. **Action Execution Layer**: Remove, ban, comment, flair, report, approve
6. **Storage Layer**: Redis for rules, config, stats, cache, audit logs

### Data Flow
```
Reddit Event → Event Handler → Rule Engine → Content Analysis → AI Analysis (if needed) → Action Execution → Storage (logs, stats) → Done
```

### Cost Optimization
- OpenAI Moderation API: Free (Stage 1)
- Prompt caching: 90% savings on system prompts
- Response caching: 80% reduction in AI calls (24h TTL)
- Batch processing: 50% discount when possible
- **Result**: $0-50/month for 10k posts/day

---

## Git Strategy (Not Yet Initialized)

### Branches
- `main`: Production-ready code only
- `develop`: Integration branch
- `feature/*`: Individual features

### Commit Frequency
- **After EVERY completed task** (not at end of session!)
- Small, frequent commits > large, infrequent commits

### What to Commit
- ✅ Source code
- ✅ Documentation (keep updated!)
- ✅ Configuration files (except secrets)

### What NOT to Commit
- ❌ `.env` files with credentials
- ❌ `node_modules/`
- ❌ API keys
- ❌ Secrets of any kind

---

## Quality Gates (Must Follow Strictly!)

### Before Writing Code
- [ ] Design documented
- [ ] User approved approach (for major features)
- [ ] Architect reviewed (for architecture changes)

### Before Committing
- [ ] Code review completed (code-reviewer agent)
- [ ] Tests written and passing
- [ ] No console errors
- [ ] Documentation updated
- [ ] Security review (if handling credentials)

### Before Deployment
- [ ] All quality gates passed
- [ ] Integration tests pass
- [ ] Security audit done
- [ ] User approved deployment

---

## Development Workflow Reminder

**MANDATORY 9-Step Process** (see CLAUDE.md for details):
1. **Plan & Design** - Break down task, use TodoWrite
2. **Implement** - Deploy specialized agent (NOT yourself!)
3. **Code Review** - Deploy code-reviewer agent
4. **Design Tests** - Deploy test-automator agent
5. **Run Tests** - Execute and verify pass
6. **Fix Issues** - Deploy debugger if needed
7. **Update Documentation** - Update project-status.md and resume-prompt.md
8. **Git Commit** - Commit after each task
9. **Report Status** - Inform user, update todos

**You are a project manager, not a coder!**

---

## Session Start Checklist

When starting a new session:
1. [ ] Read `./docs/resume-prompt.md` (this file)
2. [ ] Read `./docs/project-status.md` for current state
3. [ ] Review recent git commits (once repo exists)
4. [ ] Check CLAUDE.md for any workflow updates
5. [ ] Ask user what to work on (if not obvious)
6. [ ] Create TodoWrite list for the session
7. [ ] Follow the 9-step workflow for every task

---

## Important Notes

- **This is a moderation tool**: Prioritize accuracy and transparency over automation
- **False positives are worse than false negatives**: Better to miss violations than wrongly punish
- **Always provide appeal mechanisms**: Users must be able to contest automated actions
- **Keep moderators in the loop**: Notify of all significant actions
- **Document everything**: Future sessions depend on accurate documentation
- **Commit frequently**: After every task, not at end of session

---

## Next Session Should Start With

"I'm picking up work on the Reddit AI Automod project. Let me read the resume prompt and project status to understand where we are..."

Then:
1. Read this file (resume-prompt.md)
2. Read project-status.md
3. Ask user: "Ready to proceed with Phase 1, or do you want to review the planning documents first?"

---

**Status**: Planning complete ✅
**Ready for**: User approval → Phase 1 implementation
**Estimated time to MVP**: 6-8 weeks (5 phases)
