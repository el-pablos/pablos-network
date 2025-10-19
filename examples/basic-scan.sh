#!/bin/bash

# Pablos Network - Basic Scan Example
# This script demonstrates a complete scan workflow

GATEWAY="http://localhost:4000"
DOMAIN="example.com"

echo "🚀 Pablos Network - Basic Scan Example"
echo "========================================"
echo ""

# Step 1: Add domain to scope
echo "📝 Step 1: Adding domain to scope..."
SCOPE_RESPONSE=$(curl -s -X POST "$GATEWAY/scope" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"domain\",\"fqdn\":\"$DOMAIN\",\"verify\":\"dns\"}")

echo "$SCOPE_RESPONSE" | jq '.'
ASSET_ID=$(echo "$SCOPE_RESPONSE" | jq -r '.asset.id')
TOKEN=$(echo "$SCOPE_RESPONSE" | jq -r '.verification.record' | awk '{print $NF}')

echo ""
echo "✅ Domain added. Asset ID: $ASSET_ID"
echo "⚠️  Verification required: Add DNS TXT record"
echo "   $(echo "$SCOPE_RESPONSE" | jq -r '.verification.record')"
echo ""

# Step 2: Verify domain (in real scenario, wait for DNS propagation)
echo "📝 Step 2: Verifying domain ownership..."
echo "   (In production, verify DNS record is actually set)"
read -p "Press Enter when DNS record is set, or skip for passive scan only..."

VERIFY_RESPONSE=$(curl -s -X POST "$GATEWAY/scope/verify" \
  -H "Content-Type: application/json" \
  -d "{\"domain\":\"$DOMAIN\",\"method\":\"dns\",\"token\":\"$TOKEN\"}")

echo "$VERIFY_RESPONSE" | jq '.'
echo ""

# Step 3: Run passive scan
echo "📝 Step 3: Running passive OSINT scan..."
PASSIVE_RESPONSE=$(curl -s -X POST "$GATEWAY/scan/passive" \
  -H "Content-Type: application/json" \
  -d "{\"domain\":\"$DOMAIN\"}")

echo "$PASSIVE_RESPONSE" | jq '.'
JOB_IDS=$(echo "$PASSIVE_RESPONSE" | jq -r '.jobs[].jobId')
echo ""
echo "✅ Passive scan started. Job IDs:"
echo "$JOB_IDS"
echo ""

# Step 4: Wait for scans to complete
echo "⏳ Waiting for scans to complete (30 seconds)..."
sleep 30
echo ""

# Step 5: Get findings
echo "📝 Step 5: Retrieving findings..."
FINDINGS_RESPONSE=$(curl -s "$GATEWAY/findings?domain=$DOMAIN")

echo "$FINDINGS_RESPONSE" | jq '.'
FINDINGS_COUNT=$(echo "$FINDINGS_RESPONSE" | jq '.total')
echo ""
echo "✅ Found $FINDINGS_COUNT findings"
echo ""

# Step 6: Get statistics
echo "📝 Step 6: Getting findings statistics..."
STATS_RESPONSE=$(curl -s "$GATEWAY/findings/stats?domain=$DOMAIN")

echo "$STATS_RESPONSE" | jq '.'
echo ""

# Step 7: Get subdomains
echo "📝 Step 7: Getting discovered subdomains..."
SUBS_RESPONSE=$(curl -s "$GATEWAY/assets/$DOMAIN/subs?all=true")

echo "$SUBS_RESPONSE" | jq '.'
SUBS_COUNT=$(echo "$SUBS_RESPONSE" | jq '.total')
echo ""
echo "✅ Found $SUBS_COUNT subdomains"
echo ""

echo "🎉 Scan complete!"
echo ""
echo "Next steps:"
echo "  - Review findings at: $GATEWAY/findings?domain=$DOMAIN"
echo "  - Run web discovery: curl -X POST $GATEWAY/scan/web -d '{\"domain\":\"$DOMAIN\",\"mode\":\"safe\"}'"
echo "  - Generate report: curl -X POST http://localhost:4001/report -d '{\"domain\":\"$DOMAIN\",\"findings\":[...]}'"

