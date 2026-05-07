#!/bin/bash
# CrossTrack — Local Dev Start Script
# Usage: bash start-local.sh
#
# Set secrets in a .env.local file or export them before running:
#   export GOOGLE_CLIENT_ID="..."
#   export GOOGLE_CLIENT_SECRET="..."
#   export GEMINI_API_KEY="..."
#   export MAIL_PASSWORD="..."

JAVA=/Library/Java/JavaVirtualMachines/amazon-corretto-17.jdk/Contents/Home/bin/java
CP=/Users/dineshnannapaneni/Desktop/CrossTrack/crosstrack-api/target/classes

DEPS=$(JAVA_HOME=/Library/Java/JavaVirtualMachines/amazon-corretto-17.jdk/Contents/Home \
  mvn -f /Users/dineshnannapaneni/Desktop/CrossTrack/crosstrack-api/pom.xml \
  -q dependency:build-classpath -Dmdep.outputFile=/dev/stdout 2>/dev/null)

echo "Starting CrossTrack backend on :8080 ..."

# ── Email / OTP ────────────────────────────────────────────────────────────────
# To send real password-reset emails, set these two vars before starting:
#   export MAIL_USERNAME="you@gmail.com"
#   export MAIL_PASSWORD="your-gmail-app-password"   (use a Gmail App Password)
# Without them, the app runs in dev-mode: OTP is printed to console & shown in browser.
# ──────────────────────────────────────────────────────────────────────────────

exec $JAVA \
  -XX:TieredStopAtLevel=1 -Xmx512m \
  -DDB_URL="jdbc:mysql://localhost:3306/crosstrack_db?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true" \
  -DDB_USERNAME="crosstrack_user" \
  -DDB_PASSWORD="crosstrack_local" \
  -DJWT_SECRET="crosstrack-local-dev-secret-key-for-hs512-algorithm-must-be-64-chars-min!!" \
  -DGOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
  -DGOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
  -DGOOGLE_REDIRECT_URI="http://localhost:8080/api/gmail/callback" \
  -DGEMINI_API_KEY="${GEMINI_API_KEY}" \
  -DRAPIDAPI_KEY="${RAPIDAPI_KEY}" \
  -DALLOWED_ORIGINS="http://localhost:*" \
  -DMAIL_USERNAME="${MAIL_USERNAME:-dineshnannapaneni9@gmail.com}" \
  -DMAIL_PASSWORD="${MAIL_PASSWORD}" \
  -cp "$CP:$DEPS" \
  com.crosstrack.api.CrosstrackApiApplication
