#!/bin/bash
set -e  # Exit on error

echo "🚀 Starting upload process..."
echo ""

# Default to patch bump
BUMP_TYPE="${1:-patch}"

echo "📦 Uploading to Reddit with --bump $BUMP_TYPE..."
echo ""

# Capture devvit upload output
UPLOAD_OUTPUT=$(devvit upload --bump "$BUMP_TYPE" 2>&1)
echo "$UPLOAD_OUTPUT"
echo ""

# Extract version number from output
# Looking for patterns like "0.1.86" or "version 0.1.86"
VERSION=$(echo "$UPLOAD_OUTPUT" | grep -oP '(\d+\.\d+\.\d+)' | head -1)

if [ -z "$VERSION" ]; then
  echo "❌ Error: Could not extract version number from upload output"
  echo "Please update README.md and package.json manually"
  exit 1
fi

echo "✅ Upload successful! Version: $VERSION"
echo ""

# Update README.md badge
echo "📝 Updating README.md..."
sed -i "s/version-[0-9]\+\.[0-9]\+\.[0-9]\+/version-$VERSION/" README.md

# Update package.json
echo "📝 Updating package.json..."
sed -i "s/\"version\": \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\": \"$VERSION\"/" package.json

echo "✅ Updated README.md and package.json to version $VERSION"
echo ""

# Commit the changes
echo "📝 Committing version update..."
git add README.md package.json
git commit -m "chore: bump version to $VERSION"

echo "✅ Committed version update"
echo ""

# Push to remote
echo "🚀 Pushing to remote..."
git push

echo ""
echo "✅ All done! Version $VERSION uploaded and committed."
echo ""
echo "⚠️  Don't forget to manually update:"
echo "   - docs/project-status.md (Current Version)"
echo "   - docs/resume-prompt.md (Current Version)"
