#!/bin/bash
# Blog Post Validation Hook
# Runs after Edit/Write on blog markdown files

# Extract file path from tool input (JSON)
FILE_PATH=$(echo "$1" | grep -o '"file_path":"[^"]*"' | cut -d'"' -f4)

# Only validate markdown files in blog directory
if [[ ! "$FILE_PATH" =~ blog/content/.*\.md$ ]]; then
  exit 0
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

WARNINGS=""
ERRORS=""

# Check for emojis (brand violation)
if grep -qP '[\x{1F300}-\x{1F9FF}]' "$FILE_PATH" 2>/dev/null; then
  WARNINGS="$WARNINGS\n- Emojis detected (against brand guidelines)"
fi

# Check for FAQ section
if ! grep -q "Frequently Asked Questions\|## FAQ" "$FILE_PATH"; then
  WARNINGS="$WARNINGS\n- Missing FAQ section (recommended for AEO)"
fi

# Check for Legora link somewhere in the content
if ! grep -q "legora.ai\|Legora" "$FILE_PATH"; then
  WARNINGS="$WARNINGS\n- No mention of Legora in content"
fi

# Check for banned vocabulary
BANNED_WORDS="crucial|delve|showcase|pivotal|intricate|tapestry|underscore|captivate|foster|garner|emphasize|enhance"
if grep -qiE "$BANNED_WORDS" "$FILE_PATH"; then
  FOUND_WORDS=$(grep -oiE "$BANNED_WORDS" "$FILE_PATH" | sort -u | tr '\n' ', ')
  WARNINGS="$WARNINGS\n- Banned vocabulary found: $FOUND_WORDS"
fi

# Check for banned patterns
if grep -qi "In conclusion\|In summary\|Not only.*but also" "$FILE_PATH"; then
  WARNINGS="$WARNINGS\n- Banned pattern detected (In conclusion, In summary, Not only...but also)"
fi

# Check frontmatter
if ! head -20 "$FILE_PATH" | grep -q "meta-description:"; then
  WARNINGS="$WARNINGS\n- Missing meta-description in frontmatter"
fi

# Check for clickbait title patterns
CLICKBAIT_WORDS="shocking|unbelievable|secret|hack|amazing|incredible|insane"
TITLE=$(grep -m1 "h1-title:" "$FILE_PATH" | cut -d'"' -f2)
if echo "$TITLE" | grep -qiE "$CLICKBAIT_WORDS"; then
  WARNINGS="$WARNINGS\n- Potential clickbait word in title"
fi

# Check title length
if [ -n "$TITLE" ]; then
  TITLE_LEN=${#TITLE}
  if [ "$TITLE_LEN" -gt 60 ]; then
    WARNINGS="$WARNINGS\n- Title over 60 chars (may truncate in SERP)"
  fi
fi

# Check for statistics that might lack source links (simple heuristic)
# Warn if lines have percentages or dollar amounts without nearby markdown links
STATS_WITHOUT_LINKS=$(grep -n '%\|$[0-9]' "$FILE_PATH" | grep -v '\[.*\](http' | head -3)
if [ -n "$STATS_WITHOUT_LINKS" ]; then
  WARNINGS="$WARNINGS\n- Some statistics may lack source links (review manually)"
fi

# Output results
if [[ -n "$ERRORS" ]]; then
  echo -e "BLOG VALIDATION ERRORS:$ERRORS"
  exit 1
fi

if [[ -n "$WARNINGS" ]]; then
  echo -e "BLOG VALIDATION WARNINGS:$WARNINGS"
fi

exit 0
