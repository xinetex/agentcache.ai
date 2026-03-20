# Quick Start: Lyve Cloud Downloads

Fix your "SignatureDoesNotMatch" errors and test downloads in 3 steps.

## Step 1: Configure Credentials

Edit `.env.lyve` with your actual credentials:

```bash
LYVE_ACCESS_KEY_ID=STX1AAB7AM0VNPCIHRJHGOE6KPSW
LYVE_SECRET_ACCESS_KEY=your-actual-secret-key
LYVE_ENDPOINT=https://s3.us-east-1.lyvecloud.seagate.com
LYVE_BUCKET=jettydata-prod
LYVE_REGION=us-east-1
```

**Critical:** The region in your endpoint must match `LYVE_REGION`!

Load the environment:
```bash
source .env.lyve
```

## Step 2: Test Connection

List files to verify your credentials work:
```bash
node scripts/test-lyve-download.js list users/2/
```

If this works, your configuration is correct! ✅

## Step 3: Download or Generate URL

**Option A - Direct download:**
```bash
node scripts/test-lyve-download.js download users/2/AUDIO1.TV.PDF ./audio.pdf
```

**Option B - Generate presigned URL:**
```bash
node scripts/test-lyve-download.js presigned users/2/AUDIO1.TV.PDF
```

Copy the URL and use it in your browser or share it.

## Troubleshooting

**"SignatureDoesNotMatch"**
- Check that endpoint region matches `LYVE_REGION`
- Verify your secret key is correct

**"NoSuchKey"**
- File path is wrong, run `list` to see available files

**"Access Denied"**
- Credentials don't have permission for this bucket/file

## Need More Help?

See full documentation: `docs/LYVE_CLOUD_SETUP.md`
