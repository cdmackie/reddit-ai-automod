# Resume Prompt

## Quick Context
Reddit AI Automod is a Devvit-based moderation tool that uses AI (OpenAI + Gemini) to automate content moderation with both predetermined and custom rules. Built with TypeScript, Redis storage, and a hybrid two-stage AI strategy for cost efficiency.

**Stack**: Reddit Devvit (TypeScript), Redis, OpenAI API, Google Gemini API
**Current Phase**: Phase 1 - Foundation & Setup (Complete ✅) | Phase 2 - Rule Engine Core (Ready to Start)

---

## What's Been Done

### Planning & Documentation (Complete - 2025-10-25)
- ✅ Created comprehensive development workflow guide (CLAUDE.md - local only)
- ✅ Researched Reddit Devvit platform capabilities and limitations
- ✅ Researched OpenAI and Gemini API integration strategies
- ✅ Documented 20 predetermined moderation rules across 6 categories
- ✅ Designed custom rule configuration system with full UI mockups
- ✅ Created detailed system architecture document
- ✅ Created 6-phase implementation plan (6-8 weeks total)
- ✅ Initialized project status tracking
- ✅ Created this resume prompt for session continuity

### Git Repository Setup (Complete - 2025-10-25)
- ✅ Initialized git repository on main branch
- ✅ Created comprehensive .gitignore
- ✅ Configured to exclude CLAUDE.md and research files from git
- ✅ Committed essential planning documentation (8 files tracked)
- ✅ 5 commits completed
- ✅ Repository clean and ready for Phase 1

### Phase 1: Foundation & Setup (Complete ✅ - 2025-10-25)
- ✅ Organized research files into docs/research/
- ✅ Installed Node.js v20.19.5
- ✅ Installed Devvit CLI v0.12.1 globally
- ✅ Created Devvit project structure (package.json, tsconfig.json, devvit.yaml)
- ✅ Set up modular src/ directory (handlers, rules, ai, storage, types, utils, config)
- ✅ Created README.md files for each module
- ✅ Installed all npm dependencies (403 packages)
- ✅ Created main.tsx entry point
- ✅ Initialized git branch strategy (main + develop)
- ✅ Created test subreddit r/AiAutomod
- ✅ Created bot account u/aiautomodapp (moderator)
- ✅ Authenticated Devvit CLI (devvit login)
- ✅ Created developer account at developers.reddit.com
- ✅ Registered app "AI-Automod-App"
- ✅ Implemented type definitions (events.ts, storage.ts, config.ts)
- ✅ Implemented Redis storage layer (redis.ts, audit.ts)
- ✅ Implemented PostSubmit event handler
- ✅ Implemented CommentSubmit event handler
- ✅ Deployed to playtest subreddit r/ai_automod_app_dev
- ✅ Fixed API compatibility issues (post.subredditName, audit array handling)
- ✅ Tested with real Reddit events (3 posts, 1 comment)
- ✅ Committed working foundation to develop branch (7 total commits)

---

## Current State

**Status**: Phase 1 complete ✅ - Event handlers and storage layer working. Ready for Phase 2: Rule Engine Core

**What Exists**:
- `/home/cdm/redditmod/CLAUDE.md` - Development best practices (local only, not in git)
- `/home/cdm/redditmod/.git/` - Git repository (7 commits on develop branch)
- `/home/cdm/redditmod/.gitignore` - Comprehensive exclusion rules
- `/home/cdm/redditmod/README.md` - Project overview
- `/home/cdm/redditmod/package.json` - Devvit dependencies configured
- `/home/cdm/redditmod/tsconfig.json` - TypeScript configuration
- `/home/cdm/redditmod/devvit.yaml` - Devvit app configuration
- `/home/cdm/redditmod/node_modules/` - 403 packages installed (not in git)
- `/home/cdm/redditmod/docs/` - All planning documents + research/ subfolder
- `/home/cdm/redditmod/src/` - Modular source structure
  - `main.tsx` - Entry point with event handler registration ✅
  - `handlers/postSubmit.ts` - PostSubmit event handler ✅
  - `handlers/commentSubmit.ts` - CommentSubmit event handler ✅
  - `storage/redis.ts` - Redis storage abstraction layer ✅
  - `storage/audit.ts` - Audit logging system ✅
  - `types/events.ts` - Event type definitions ✅
  - `types/storage.ts` - Storage type definitions ✅
  - `types/config.ts` - Configuration types ✅
  - `rules/` - Rule engine (ready for Phase 2 implementation)
  - `ai/` - AI integrations (ready for Phase 3 implementation)
  - `utils/` - Utilities (ready for implementation as needed)
  - `config/` - Configuration (ready for implementation as needed)

**Reddit Infrastructure**:
- Test subreddit: r/AiAutomod ✅
- Bot account: u/aiautomodapp (moderator) ✅
- Playtest subreddit: r/ai_automod_app_dev (auto-created by Devvit) ✅
- App registration: "AI-Automod-App" ✅
- Deployment: Active and capturing events ✅

**What Doesn't Exist Yet**:
- .env file for AI API keys (OpenAI, Gemini) - needed for Phase 3
- Rule matching engine - Phase 2 work
- Condition evaluator - Phase 2 work
- Action execution layer - Phase 2 work
- AI integration layer - Phase 3 work
- Predetermined rules - Phase 4 work
- Custom rule UI - Phase 5 work

---

## What's Next

### Immediate Next Steps (Phase 2: Rule Engine Core)
1. **Design rule data structure**:
   - Define Rule type with conditions, actions, priority
   - Design storage schema for rules in Redis
   - Create rule builder utility functions

2. **Implement rule matching engine**:
   - `src/rules/matcher.ts` - Match content against rules
   - Support text matching, regex patterns, keywords
   - Handle rule priority and conflict resolution

3. **Create condition evaluator**:
   - `src/rules/evaluator.ts` - Evaluate rule conditions
   - Text contains/matches logic
   - User history checks
   - Content type checks (post vs comment)

4. **Build action execution layer**:
   - `src/rules/actions.ts` - Execute moderation actions
   - Implement: REMOVE, FLAG, APPROVE, IGNORE
   - Log all actions via audit logger
   - Handle action failures gracefully

5. **Test rule engine**:
   - Create simple test rules
   - Deploy and test in playtest mode
   - Verify actions execute correctly
   - Verify audit logging captures all actions

6. **Commit Phase 2**: Document and commit working rule engine

### After Phase 2 Complete
1. Phase 3: AI Integration (OpenAI Moderation API + GPT-4/Gemini)
2. Phase 4: Implement 20 predetermined rules
3. Phase 5: Custom rule builder UI

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

### Source Code (Structure Created, Implementation Needed)
- `src/main.tsx`: Entry point (✅ basic setup done)
- `src/handlers/`: Event handlers (📁 structure ready, needs implementation)
- `src/rules/`: Rule engine (📁 structure ready, needs implementation)
- `src/ai/`: AI providers (📁 structure ready, needs implementation)
- `src/storage/`: Redis layer (📁 structure ready, needs implementation)
- `src/types/`: Type definitions (📁 structure ready, needs implementation)
- `src/utils/`: Utilities (📁 structure ready, needs implementation)
- `src/config/`: Configuration (📁 structure ready, needs implementation)

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

## Git Strategy (✅ Initialized)

**Current Status**:
- Repository: Initialized on main branch
- Commits: 5 commits completed
- Tracked files: 8 (essential docs only)
- Excluded: CLAUDE.md, research files (local only)

### Branches
- `main`: Production-ready code only (current branch)
- `develop`: Integration branch (to be created)
- `feature/*`: Individual features (to be created as needed)

### Commit Frequency
- **After EVERY completed task** (not at end of session!)
- Small, frequent commits > large, infrequent commits

### What to Commit
- ✅ Source code
- ✅ Documentation (keep updated!)
- ✅ Configuration files (except secrets)

### What NOT to Commit (Already in .gitignore)
- ❌ CLAUDE.md (development workflow - local only)
- ❌ Research files (AI-generated docs - local only)
- ❌ `.env` files with credentials
- ❌ `node_modules/`
- ❌ API keys
- ❌ Secrets of any kind

### Commit History
```
ed17dd3 chore: initialize Devvit project structure (main)
b4b79c6 docs: finalize project status after git cleanup
3a169c7 chore: update .gitignore to exclude development meta files
f0957e7 docs: update project status after planning completion
da4fc23 docs: add project README with overview and quickstart
5d67eb8 docs: initial project planning and architecture
```

### Current Branch: develop
- Working branch for Phase 1 implementation
- Will merge to main when Phase 1 complete

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

**Status**: Phase 1 complete ✅ | Event handlers operational ✅ | Deployed to playtest ✅
**Ready for**: Phase 2 - Rule Engine Core implementation
**Estimated time to MVP**: 5-7 weeks remaining (4 phases)

---

## Session Summary (2025-10-25)

### Session 1: Planning Phase
**Completed**:
1. ✅ Comprehensive planning and research
2. ✅ Created 7 planning documents (~15,000 words)
3. ✅ Initialized git repository
4. ✅ Configured .gitignore (CLAUDE.md and research files excluded)
5. ✅ 5 commits completed
6. ✅ Repository clean and ready

### Session 2: Phase 1 Complete ✅
**Completed**:
1. ✅ Organized research files into docs/research/
2. ✅ Installed Devvit CLI v0.12.1
3. ✅ Created Devvit project structure
4. ✅ Set up package.json, tsconfig.json, devvit.yaml
5. ✅ Created modular src/ directory structure
6. ✅ Installed 403 npm packages
7. ✅ Created main.tsx entry point
8. ✅ User created test subreddit r/AiAutomod
9. ✅ User created bot account u/aiautomodapp
10. ✅ Authenticated Devvit CLI
11. ✅ User created developer account
12. ✅ User registered app "AI-Automod-App"
13. ✅ Implemented type definitions (events.ts, storage.ts, config.ts)
14. ✅ Implemented Redis storage layer (redis.ts, audit.ts)
15. ✅ Implemented PostSubmit handler
16. ✅ Implemented CommentSubmit handler
17. ✅ Deployed to playtest (r/ai_automod_app_dev)
18. ✅ Fixed API compatibility issues
19. ✅ Tested with real Reddit events
20. ✅ Committed working foundation (7 commits)
21. ✅ Updated project-status.md and resume-prompt.md
22. ✅ **Phase 1 complete - Event-driven architecture operational**

**Files in Git** (27 tracked on develop branch):
- .gitignore
- README.md
- package.json, package-lock.json
- tsconfig.json
- devvit.yaml
- src/main.tsx
- src/handlers/postSubmit.ts
- src/handlers/commentSubmit.ts
- src/storage/redis.ts
- src/storage/audit.ts
- src/types/events.ts
- src/types/storage.ts
- src/types/config.ts
- src/*/README.md (7 READMEs)
- docs/*.md (6 planning docs)

**Files Not in Git** (local only):
- CLAUDE.md (development workflow)
- node_modules/ (403 packages)
- docs/research/ (AI-generated reference docs)

**Current Branch**: develop (7 commits)
**Last Commit**: acee755 - fix: resolve Devvit API compatibility issues
