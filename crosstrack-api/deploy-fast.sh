#!/bin/bash
# deploy-fast.sh — Build JAR locally, deploy directly to EB Corretto 17 (no Docker!)
# Usage: ./deploy-fast.sh [version-label]
# Requires: Java 17, AWS CLI configured with credentials

set -e

REGION="us-east-2"
EB_ENV="crosstrack-prod"
EB_APP="crosstrack"
SOLUTION_STACK="64bit Amazon Linux 2023 v4.11.2 running Corretto 17"
S3_BUCKET=$(aws s3 ls | grep elasticbeanstalk | grep "$REGION" | awk '{print $3}' | head -1)
VERSION_LABEL="${1:-crosstrack-fast-$(date +%Y%m%d-%H%M%S)}"
DEPLOY_DIR=$(mktemp -d)

echo "=== CrossTrack Fast Deploy (Java SE — no Docker) ==="
echo "Version: $VERSION_LABEL"

# 1. Ensure Java 17
echo ""
echo "[1/5] Setting up Java 17..."
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null) || {
  echo "ERROR: Java 17 not found. Install with: brew install --cask temurin@17"
  exit 1
}
echo "  Java: $(java -version 2>&1 | head -1)"

# 2. Build the JAR
echo ""
echo "[2/5] Building JAR with Maven..."
cd "$(dirname "$0")"
./mvnw package -DskipTests -q
JAR=$(ls target/crosstrack-api-*.jar 2>/dev/null | head -1)
if [ -z "$JAR" ]; then
  echo "ERROR: No JAR found in target/. Build failed."
  exit 1
fi
JAR_SIZE=$(du -sh "$JAR" | cut -f1)
echo "  Built: $JAR ($JAR_SIZE)"

# 3. Create deployment package: JAR + Procfile (no Docker)
echo ""
echo "[3/5] Creating deployment package..."
cp "$JAR" "$DEPLOY_DIR/app.jar"
cat > "$DEPLOY_DIR/Procfile" <<'PROCFILE'
web: java -Xms64m -Xmx384m -XX:MetaspaceSize=64m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom -Dserver.port=5000 -jar app.jar
PROCFILE

ZIP_FILE="$DEPLOY_DIR/deploy.zip"
cd "$DEPLOY_DIR" && zip -q deploy.zip app.jar Procfile
ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
echo "  Package: deploy.zip ($ZIP_SIZE)"

# 4. Upload to S3
echo ""
echo "[4/5] Uploading to S3..."
if [ -z "$S3_BUCKET" ]; then
  echo "  Auto-detecting S3 bucket failed. Creating..."
  S3_BUCKET="elasticbeanstalk-${REGION}-$(aws sts get-caller-identity --query Account --output text)"
  aws s3 mb "s3://$S3_BUCKET" --region "$REGION" 2>/dev/null || true
fi
S3_KEY="crosstrack/$VERSION_LABEL.zip"
aws s3 cp "$ZIP_FILE" "s3://$S3_BUCKET/$S3_KEY" --region "$REGION"
echo "  Uploaded: s3://$S3_BUCKET/$S3_KEY"

# 5. Create EB version and deploy (switching to Corretto 17 platform)
echo ""
echo "[5/5] Deploying to Elastic Beanstalk (Corretto 17)..."
aws elasticbeanstalk create-application-version \
  --application-name "$EB_APP" \
  --version-label "$VERSION_LABEL" \
  --source-bundle S3Bucket="$S3_BUCKET",S3Key="$S3_KEY" \
  --region "$REGION" \
  --query 'ApplicationVersion.VersionLabel' --output text

aws elasticbeanstalk update-environment \
  --environment-name "$EB_ENV" \
  --version-label "$VERSION_LABEL" \
  --solution-stack-name "$SOLUTION_STACK" \
  --region "$REGION" \
  --option-settings \
    "Namespace=aws:elasticbeanstalk:command,OptionName=Timeout,Value=600" \
    "Namespace=aws:elasticbeanstalk:application,OptionName=Application Healthcheck URL,Value=/api/health" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=ALLOWED_ORIGINS,Value=https://d1um5wttr7o1i.cloudfront.net" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=GOOGLE_REDIRECT_URI,Value=https://d1um5wttr7o1i.cloudfront.net/api/gmail/callback" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=FRONTEND_URL,Value=https://d1um5wttr7o1i.cloudfront.net" \
  --query 'EnvironmentName' --output text

echo ""
echo "=== Deploying $VERSION_LABEL on Corretto 17 (no Docker!) ==="
echo "Polling for Ready status (expect ~5 min for platform switch)..."

for i in $(seq 1 24); do
  STATUS=$(aws elasticbeanstalk describe-environments \
    --environment-names "$EB_ENV" --region "$REGION" \
    --query 'Environments[0].{H:Health,S:Status,V:VersionLabel}' --output text)
  echo "  $(date +%H:%M:%S) $STATUS"
  echo "$STATUS" | grep -q 'Ready' && echo "" && echo "✅ App is live at https://d1um5wttr7o1i.cloudfront.net" && break
  sleep 30
done

# Cleanup
rm -rf "$DEPLOY_DIR"
