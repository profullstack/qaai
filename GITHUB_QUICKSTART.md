# GitHub Integration Quick Start

Get QAAI's GitHub integration up and running in 5 minutes.

## Prerequisites

- QAAI instance running and accessible via HTTPS
- GitHub account with admin access to repositories
- Node.js 20+ installed

## Quick Setup

### 1. Create GitHub App (2 minutes)

```bash
# Go to: https://github.com/settings/apps/new

# Fill in:
Name: QAAI Test Runner
Homepage URL: https://your-qaai-instance.com
Webhook URL: https://your-qaai-instance.com/api/webhooks/github
Webhook Secret: [generate random string]

# Permissions:
- Checks: Read & Write
- Contents: Read
- Issues: Read & Write
- Pull requests: Read

# Events:
- Check run
- Check suite
- Pull request

# Click "Create GitHub App"
```

### 2. Configure Environment (1 minute)

```bash
# Download private key from GitHub App settings
# Add to .env:

GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_APP_PRIVATE_KEY_B64=$(cat private-key.pem | base64 -w 0)
```

### 3. Install App (1 minute)

```bash
# In GitHub App settings, click "Install App"
# Choose repositories
# Note the installation ID from URL
# Add to .env:

GITHUB_INSTALLATION_ID=12345678
```

### 4. Configure Project (1 minute)

In QAAI web interface:
1. Go to Project Settings
2. Set GitHub Repository: `owner/repo`
3. Enable "Auto-create issues"
4. Save

## Test It

1. Open a PR in your repository
2. QAAI will automatically:
   - Create a test run
   - Post a pending check
   - Execute tests
   - Post results as check run
   - Create issues for failures (if enabled)

## Verify Setup

```bash
# Check webhook deliveries in GitHub App settings
# View recent deliveries and responses

# Check QAAI logs
docker logs qaai-runner

# Test webhook manually
curl -X POST https://your-qaai-instance.com/api/webhooks/github \
  -H "X-GitHub-Event: ping" \
  -H "Content-Type: application/json" \
  -d '{"zen": "test"}'
```

## Common Issues

**Webhook not working?**
- Ensure URL is publicly accessible
- Check webhook secret matches
- Verify SSL certificate is valid

**Check runs not appearing?**
- Verify GitHub App permissions
- Check installation ID is correct
- Review runner logs for errors

**Issues not created?**
- Enable auto-create in project settings
- Verify issues permission granted
- Check repository name format

## Next Steps

- [Full Documentation](./GITHUB_INTEGRATION.md)
- [API Reference](./API.md)
- [Troubleshooting Guide](./GITHUB_INTEGRATION.md#troubleshooting)

## Support

Need help? Check:
1. [Troubleshooting](./GITHUB_INTEGRATION.md#troubleshooting)
2. GitHub App logs
3. QAAI runner logs
4. [Open an issue](https://github.com/your-org/qaai/issues)