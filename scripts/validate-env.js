#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * Run this before deploying to Railway to ensure all required variables are set
 */

console.log("🔍 Validating Environment Variables for Railway Deployment...\n");

const requiredVars = {
  Database: ["MONGO_URI"],
  Authentication: ["JWT_SECRET"],
  "Email Service": ["EMAIL_USER", "EMAIL_PASS"],
  Firebase: [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ],
};

const optionalVars = {
  "Application URLs (set after initial deployment)": [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SOCKET_URL",
    "NEXT_PUBLIC_YJS_URL",
  ],
  "Server Ports (auto-assigned by Railway)": ["PORT", "SOCKET_PORT"],
  "Firebase Analytics": ["NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"],
};

let hasErrors = false;
let warnings = 0;

// Check required variables
console.log("✅ Required Environment Variables:\n");
Object.entries(requiredVars).forEach(([category, vars]) => {
  console.log(`📋 ${category}:`);
  vars.forEach((varName) => {
    const value = process.env[varName];
    if (!value) {
      console.log(`  ❌ ${varName} - NOT SET`);
      hasErrors = true;
    } else if (value.includes("your-") || value.includes("example")) {
      console.log(`  ⚠️  ${varName} - SET (but appears to be placeholder)`);
      hasErrors = true;
    } else {
      const maskedValue = value.substring(0, 10) + "...";
      console.log(`  ✅ ${varName} - ${maskedValue}`);
    }
  });
  console.log("");
});

// Check optional variables
console.log("ℹ️  Optional Environment Variables:\n");
Object.entries(optionalVars).forEach(([category, vars]) => {
  console.log(`📋 ${category}:`);
  vars.forEach((varName) => {
    const value = process.env[varName];
    if (!value) {
      console.log(`  ⚠️  ${varName} - NOT SET`);
      warnings++;
    } else {
      const maskedValue = value.substring(0, 20) + "...";
      console.log(`  ✅ ${varName} - ${maskedValue}`);
    }
  });
  console.log("");
});

// Summary
console.log("\n" + "=".repeat(60));
if (hasErrors) {
  console.log("❌ VALIDATION FAILED");
  console.log(
    "\nPlease set all required environment variables before deploying.",
  );
  console.log("Copy .env.example to .env and fill in the values.\n");
  process.exit(1);
} else {
  console.log("✅ VALIDATION PASSED");
  if (warnings > 0) {
    console.log(
      `\n⚠️  ${warnings} optional variable(s) not set (this is OK for initial deployment)`,
    );
  }
  console.log("\nYour environment is ready for Railway deployment! 🚀");
  console.log("\nNext steps:");
  console.log("1. Push your code to GitHub");
  console.log("2. Create a new Railway project");
  console.log("3. Add these environment variables in Railway dashboard");
  console.log("4. Deploy!\n");
  console.log("See RAILWAY_DEPLOYMENT_GUIDE.md for detailed instructions.\n");
}
