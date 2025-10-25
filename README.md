# Reddit AI Automod

An AI-powered moderation tool for Reddit built on the Devvit platform. Automates content moderation using OpenAI and Google Gemini APIs while keeping moderators in control.

## 🎯 Project Status

**Current Phase**: Planning Complete ✅
**Next Phase**: Foundation & Setup (awaiting approval)
**Progress**: 5% (Planning/Documentation)

## ✨ Features (Planned)

### Predetermined Rules
- **Spam Detection**: AI-powered spam identification
- **Hate Speech**: Zero-tolerance enforcement
- **Harassment**: Targeted attack prevention
- **Low-Effort Content**: Quality filtering
- **New User Protection**: Account age/karma restrictions
- **And 15 more** pre-built rules

### Custom Rules
- Visual rule builder (no coding required)
- Trigger configuration (posts, comments, reports)
- Condition chains (AND/OR logic)
- AI analysis integration
- Multi-action support
- Testing interface

### AI Integration
- **Stage 1**: OpenAI Moderation API (free, 85-90% accuracy)
- **Stage 2**: GPT-4/Gemini for edge cases (95%+ accuracy)
- **Cost**: $0-50/month for 10,000 posts/day
- Response caching for efficiency

## 🏗 Architecture

- **Platform**: Reddit Devvit (TypeScript)
- **Storage**: Redis (provided by Devvit)
- **AI Providers**: OpenAI, Google Gemini
- **Hosting**: Reddit-hosted (free)

## 📚 Documentation

### Start Here
- [`CLAUDE.md`](./CLAUDE.md) - Development practices and workflow

### Planning Documents
- [`docs/predetermined-rules.md`](./docs/predetermined-rules.md) - 20 pre-built moderation rules
- [`docs/custom-rule-system.md`](./docs/custom-rule-system.md) - Custom rule builder design
- [`docs/architecture.md`](./docs/architecture.md) - Complete technical architecture
- [`docs/implementation-plan.md`](./docs/implementation-plan.md) - 6-phase development plan
- [`docs/project-status.md`](./docs/project-status.md) - Current project status
- [`docs/resume-prompt.md`](./docs/resume-prompt.md) - Session continuity guide

## 🚀 Quick Start (Not Yet Implemented)

_Coming soon after Phase 1 completion_

```bash
# Install Devvit CLI
npm install -g devvit

# Clone repository
git clone <repo-url>
cd redditmod

# Install dependencies
npm install

# Start development
npm run dev
```

## 📋 Implementation Timeline

- **Phase 1**: Foundation & Setup (Weeks 1-2)
- **Phase 2**: Rule Engine Core (Weeks 2-3)
- **Phase 3**: AI Integration (Weeks 3-4)
- **Phase 4**: Predefined Rules (Weeks 4-5)
- **Phase 5**: Custom Rules & UI (Weeks 5-6)
- **Phase 6**: Polish & Launch (Weeks 6-8)

**Total Duration**: 6-8 weeks to MVP

## 💰 Cost Estimate

### Production (Per Month)
- Devvit Hosting: **$0** (free)
- Redis Storage: **$0** (included)
- OpenAI Moderation API: **$0** (free tier)
- OpenAI GPT-4 (edge cases): **$0-30**
- Google Gemini (backup): **$0-20**

**Total**: **$0-50/month** for 10,000 posts/day

## 🎓 For Developers

### Development Workflow
This project follows a strict 9-step workflow for quality assurance:
1. Plan & Design
2. Implement (using specialized agents)
3. Code Review
4. Design Tests
5. Run Tests
6. Fix Issues
7. Update Documentation
8. Git Commit
9. Report Status

See [`CLAUDE.md`](./CLAUDE.md) for complete details.

### Git Strategy
- **main**: Production-ready code only
- **develop**: Integration branch
- **feature/***: Individual features
- Commit after **every completed task**

### Quality Gates
- Code review before commit
- Tests must pass
- Documentation must be updated
- Security audit for credential handling

## 🔒 Security

- API keys stored in app settings (encrypted)
- Never commit credentials
- Input validation on all user data
- Rate limiting per user
- Audit logs for all actions

## 📝 License

_To be determined_

## 🤝 Contributing

_Coming soon after initial release_

## 📞 Support

_Coming soon_

---

**Built with** ❤️ **using Reddit Devvit, OpenAI, and Google Gemini**

🤖 **Generated with** [Claude Code](https://claude.com/claude-code)
