# Release Notes - iProTraX v8.0.0 Enterprise Edition

## 🎉 Major Release: Enterprise Upgrade

Version 8.0.0 represents a significant milestone in iProTraX's evolution, transforming it into a truly enterprise-ready manufacturing collaboration platform. This release focuses on **internationalization**, **security**, **testing**, and **deployment automation**.

---

## 🌍 Internationalization (i18n)

### Full Bilingual Support
- **Languages**: English (en) and Simplified Chinese (zh)
- **Coverage**: Complete translation of all UI components
  - Login & Registration pages
  - Dashboard & Navigation
  - Settings & User Management
  - Operation View & Modal dialogs
  - Error messages & Notifications

### Dynamic Language Switching
- **Visual Indicator**: Dynamic country flag icons (🇨🇳/🇺🇸)
  - Shows target language (not current language)
  - Intuitive for global teams
- **Persistent Selection**: Language choice saved via cookie
- **Server-Side Support**: Full SSR compatibility with `next-intl`
- **Location**: Accessible from Login page and Dashboard header

### Translation Keys
- **Structured**: 350+ translation keys organized by component
- **Files**: 
  - `messages/en.json` - English translations
  - `messages/zh.json` - Chinese translations
- **Flexibility**: Easy to add new languages

### Special Considerations
- **Technical Terms Preserved**: Production table headers (WO ID, PN, etc.) remain in English for consistency
- **Mixed Content Support**: Allows English technical terms in Chinese interface where needed

---

## 🔒 Security Enhancements

### Session Encryption
- **Library**: `jose` for JWT-based session management
- **Cookie Security**: All session cookies are signed and encrypted
- **Protection**: Guards against session tampering and hijacking
- **Implementation**: Transparent middleware-based validation

### Enhanced Middleware
- **Session Validation**: Every request validates encrypted session token
- **Auto-Logout**: Invalid or tampered tokens trigger automatic logout
- **Security Headers**: Proper CSP and security headers enforced

### Environment Configuration
- **SESSION_SECRET**: Required 32+ character secret for production
- **Example**: Updated `.env.example` with security best practices

---

## 🧪 Testing Framework

### Unit Testing (Vitest)
- **Setup**: Vitest configured with TypeScript support
- **Coverage**: Initial test suite for utility functions
  - `src/lib/date-utils.test.ts` - Date calculation tests
- **Fast**: Instant feedback during development
- **Command**: `npm test`

### End-to-End Testing (Playwright)
- **Setup**: Playwright with multiple browser support
- **Scenarios**: Basic authentication and navigation flow
  - Login with credentials
  - Navigate to Dashboard
  - Verify page elements
- **CI-Ready**: Configured for GitHub Actions
- **Command**: `npx playwright test`

### Continuous Integration
- **GitHub Actions**: Automated testing on every push
- **Workflow**: `.github/workflows/ci.yml`
  - Runs on Node.js 22
  - Executes lint checks
  - Runs unit tests
  - (E2E tests available, currently manual)

### Code Quality
- **Husky**: Pre-commit hooks ensure code quality
- **Lint-Staged**: Only lints staged files for performance
- **ESLint**: Enforces coding standards before commit

---

## ⚡ Performance Optimizations

### Database Schema Enhancement
- **New Columns**: `status` and `priority` promoted from JSON
  - Faster filtering and sorting
  - Better indexing capabilities
- **Indexes Added**:
  - `@@index([productId])`
  - `@@index([status])`
  - `@@index([priority])`
  - `@@index([timestamp])` on OperationLog
  - `@@index([action])` on OperationLog

### Data Migration
- **Backfill Script**: `scripts/backfill-orders.ts`
  - Extracts `status` and `priority` from existing JSON data
  - Updates 67 orders automatically
  - Safe and idempotent

---

## 🐳 Docker & Deployment

### Improved Docker Deployment
- **One-Click Script**: `deploy.sh`
  - Handles git updates gracefully
  - Preserves user configuration (`data/config.json`)
  - Rebuilds containers automatically
  - Cleans up old images

### Network Resilience
- **Offline Support**: Deploy script works without GitHub access
- **Error Handling**: Graceful fallback to local code
- **User Feedback**: Clear progress messages

### Database Bootstrap Fix
- **Schema Sync**: Updated bootstrap to use `prisma db push`
  - Replaces `prisma migrate deploy` for better compatibility
  - Handles both new and existing databases
- **Volume Mounting**: Correct database path in Docker (`/app/data/db/prod.db`)

### Database Fix Tooling
- **Quick Fix Script**: `fix-database.sh`
  - Automated database schema updates
  - Backup creation before changes
  - Data backfill execution
  - Safe and documented

---

## 📚 Documentation

### Comprehensive Guides
- **Troubleshooting**: `troubleshooting.md` (Artifact)
  - Database schema mismatch resolution
  - Docker deployment issues
  - Cloudflare security warnings (false positives)
  
- **Cloudflare Fix**: `cloudflare-fix.md` (Artifact)
  - Google Safe Browsing false positive handling
  - Security level adjustments
  - Appeal procedures

### Updated Examples
- **Environment**: `.env.example` with production database path
- **Deployment**: Clear Docker deployment instructions

---

## 🔧 Technical Improvements

### Build System
- **Next.js 16**: Latest stable version with Turbopack
- **React 19**: Leveraging newest React features
- **TypeScript**: Strict type checking throughout

### Dependencies
- **Updated**: All npm packages to latest compatible versions
- **Security**: Zero known vulnerabilities (audited with `npm audit`)

### Code Organization
- **Consistent Styling**: All components follow React best practices
- **Error Handling**: Improved error boundaries and user feedback
- **Type Safety**: Reduced `any` types, stronger TypeScript coverage

---

## 🐛 Bug Fixes

### Critical Fixes
1. **Hydration Errors**: Fixed SSR/client mismatch in language switcher
   - Added `suppressHydrationWarning` for dynamic content
2. **Database Connection**: Corrected DATABASE_URL in examples
3. **Docker Bootstrap**: Schema sync now works with mounted volumes
4. **Missing Steps**: Resolved visibility issues in Docker deployments

### Minor Fixes
- Login page flag layout improvements
- Dashboard language switcher positioning
- Translation key consistency
- Operation logs translation coverage

---

## 📦 What's Included

### New Files
- `messages/en.json` - English translations (363 keys)
- `messages/zh.json` - Chinese translations (363 keys)
- `src/i18n/request.ts` - Locale detection logic
- `src/components/LanguageSwitcher.tsx` - Reusable language switcher
- `src/lib/session.ts` - Session encryption utilities
- `fix-database.sh` - Database repair automation
- `vitest.config.ts` - Unit test configuration
- `playwright.config.ts` - E2E test configuration
- `src/lib/date-utils.test.ts` - Example unit tests
- `e2e/basic-flow.spec.ts` - Example E2E tests
- `.github/workflows/ci.yml` - CI/CD pipeline
- `.husky/pre-commit` - Git hooks

### Modified Files
- All dashboard pages (i18n support)
- Login & Register pages (i18n + dynamic flags)
- Middleware (session encryption)
- Docker bootstrap script (schema sync fix)
- deploy.sh (network resilience)

---

## 🚀 Upgrade Guide

### From v7.0.0 to v8.0.0

#### 1. Update Code
```bash
git pull origin main
npm install
```

#### 2. Update Database Schema
```bash
# Automatic fix (recommended)
./fix-database.sh

# Or manual steps
npx prisma db push --accept-data-loss
npx tsx scripts/backfill-orders.ts
```

#### 3. Environment Variables
Check your `.env` file:
```env
# Required for session encryption
SESSION_SECRET="your-random-32-char-secret-here"

# Update database path if needed
DATABASE_URL="file:./data/db/prod.db"
```

#### 4. Restart Application
```bash
# Development
npm run dev

# Production (Docker)
./deploy.sh
```

### Breaking Changes
- **None**: This is fully backward compatible
- **Recommendation**: Update `SESSION_SECRET` for enhanced security

---

## 🎯 Future Roadmap (v8.1 and beyond)

- [ ] Additional languages (Spanish, German, Japanese)
- [ ] Advanced E2E test coverage
- [ ] Performance monitoring dashboard
- [ ] Mobile app (React Native)
- [ ] Advanced AI analytics

---

## 👥 Contributors

Special thanks to all contributors who made this enterprise upgrade possible!

- Core team for i18n implementation
- Security audit team
- Testing framework setup
- Docker deployment improvements

---

## 📞 Support

- **Documentation**: README.md and README_ZH.md
- **Issues**: https://github.com/Tropical8818/iProTraX/issues
- **Email**: contact@iprotrax.work
- **Demo**: https://iprotrax.work

---

## 📄 License

MIT License - See LICENSE file for details

---

**Released**: January 10, 2026
**Codename**: "Enterprise Ready"
