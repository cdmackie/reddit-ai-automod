# Upload Process

## Automated Version Sync

The project uses an automated upload script (`scripts/upload.sh`) that handles version synchronization.

## Usage

```bash
# Patch version bump (most common) - 0.1.85 → 0.1.86
npm run upload

# Minor version bump - 0.1.85 → 0.2.0
npm run upload:minor

# Major version bump - 0.1.85 → 1.0.0
npm run upload:major
```

## What the Script Does

1. **Uploads to Reddit** - Runs `devvit upload --bump <type>`
2. **Extracts Version** - Parses the version number from upload output
3. **Updates README.md** - Updates the version badge automatically
4. **Updates package.json** - Updates the version field automatically
5. **Commits Changes** - Creates a commit with version bump
6. **Pushes to Remote** - Pushes the commit to origin

## Manual Steps Required

After the script completes, you still need to manually update:

1. **`docs/project-status.md`** - Update `**Current Version**: X.X.X` field
2. **`docs/resume-prompt.md`** - Update `**Current Version**: X.X.X` field

These are intentionally manual because they require context about what changed in the version (which the script cannot infer).

## Version Bumping Strategy

- **Patch** (0.1.X) - Bug fixes, minor improvements, documentation updates
- **Minor** (0.X.0) - New features, significant improvements
- **Major** (X.0.0) - Breaking changes, major architecture changes

## Troubleshooting

### Version Not Extracted

If the script can't extract the version number:

```bash
❌ Error: Could not extract version number from upload output
Please update README.md and package.json manually
```

**Solution**: Manually update:
1. README.md line 7: `version-X.X.X`
2. package.json line 3: `"version": "X.X.X"`
3. Commit and push changes

### Upload Failed

If `devvit upload` fails, the script exits without making changes. Fix the issue and run again.

## Direct devvit upload (Not Recommended)

If you need to upload without the script:

```bash
devvit upload --bump patch
```

**Remember to manually update:**
- README.md version badge
- package.json version
- docs/project-status.md version
- docs/resume-prompt.md version

## Script Location

- Script: `scripts/upload.sh`
- NPM commands defined in: `package.json` scripts section
