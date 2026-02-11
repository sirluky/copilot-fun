# Publishing Guide

This guide explains how to publish copilot-fun to npm.

## Prerequisites

- npm account with publishing permissions
- Logged in via `npm login`
- **Authenticator App**: (Google Authenticator, Authy, etc.) for TOTP if 2FA is enabled.

### Using an Access Token (Alternative)

To bypass manual login or TOTP in CI, you can use a [Granular Access Token](https://www.npmjs.com/settings/tokens):
1. Create a token with **Read and Write** permissions.
2. Select **Bypass 2FA** if you want to publish without the `--otp` flag.
3. Add it to `~/.npmrc`:
   ```bash
   echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" >> ~/.npmrc
   ```

## Publishing Steps

1. **Update version** in `package.json` following [semver](https://semver.org/):
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```
   
   Note: `npm version` automatically creates a git tag.

2. **Test the package** locally:
   ```bash
   npm pack --dry-run
   ```

3. **Publish to npm**:
   If you have 2FA enabled, you will need to provide a TOTP (Time-based One-Time Password) from your authenticator app (e.g., Google Authenticator, Authy):
   ```bash
   npm publish --otp=YOUR_CODE
   ```

4. **Push the tag** created by `npm version`:
   ```bash
   git push --follow-tags
   ```

## Post-Publishing

After publishing, users can install via:

```bash
# Run directly with npx
npx copilot-fun

# Install globally
npm install -g copilot-fun
copilot-fun
```

## Updating the curl installer

The `install.sh` script uses the GitHub repository URL. No changes needed after publishing to npm.

## Package Information

- **Package name**: `copilot-fun`
- **Binary name**: `copilot-fun`
- **License**: MIT
- **Node version**: >=18.0.0

## Files Included

The `.npmignore` file controls what gets published. Included files:
- `index.js` - Main application
- `package.json` - Package metadata
- `wasm/` - Compiled games
- `README.md`, `LICENSE`, `GAMES.md` - Documentation
- `.github/agents/` - Agent instructions
- `install.sh` - Curl installer script

Excluded files:
- Development files (Dockerfile, build scripts)
- Git files
- Runtime files (hooks, status files)
- Documentation not needed by users (POST.md, changelog.md, TODO)
