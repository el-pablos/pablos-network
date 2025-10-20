#!/usr/bin/env pwsh

# Pablos Network - CI Test Script (Windows PowerShell)
# Runs all tests and checks before deployment

Write-Host ""
Write-Host "🧪 Pablos Network - CI Test Suite" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Step 1: Build packages
Write-Host "📦 Building shared packages..." -ForegroundColor Yellow
pnpm build:packages
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Package build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Packages built successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Type check
Write-Host "🔍 Running type checks..." -ForegroundColor Yellow
pnpm type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Type check failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Type check passed" -ForegroundColor Green
Write-Host ""

# Step 3: Lint
Write-Host "🔍 Running linter..." -ForegroundColor Yellow
pnpm lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Linting issues found" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Unit tests
Write-Host "🧪 Running unit tests..." -ForegroundColor Yellow
pnpm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Unit tests failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Unit tests passed" -ForegroundColor Green
Write-Host ""

# Step 5: E2E tests
Write-Host "🧪 Running E2E tests..." -ForegroundColor Yellow
pnpm test:e2e
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ E2E tests failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ E2E tests passed" -ForegroundColor Green
Write-Host ""

# Step 6: Coverage
Write-Host "📊 Generating coverage report..." -ForegroundColor Yellow
pnpm test:coverage
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Coverage generation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Coverage report generated" -ForegroundColor Green
Write-Host ""

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "✅ All CI checks passed!" -ForegroundColor Green
Write-Host ""

