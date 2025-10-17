# GitHub Secrets Configuration Checklist

Before running the GitHub Actions deployment workflow, you need to configure the following secrets in your GitHub repository.

## How to Add Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret listed below

## Required Secrets

### GCP Configuration

- [ ] **GCP_PROJECT_ID**
  - Description: Your Google Cloud Project ID
  - Example: `my-project-12345`
  - How to get: Run `gcloud config get-value project`

- [ ] **GCP_SA_KEY**
  - Description: Service account JSON key for GitHub Actions
  - Value: Complete JSON content from the key file
  - How to get:
    ```bash
    gcloud iam service-accounts keys create key.json \
      --iam-account github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com
    cat key.json
    ```
  - Copy the entire JSON output

### Firebase Configuration

- [ ] **NEXT_PUBLIC_FIREBASE_API_KEY**
  - Description: Firebase API Key
  - Example: `AIzaSyAbC...XyZ`

- [ ] **NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN**
  - Description: Firebase Auth Domain
  - Example: `my-project.firebaseapp.com`

- [ ] **NEXT_PUBLIC_FIREBASE_PROJECT_ID**
  - Description: Firebase Project ID
  - Example: `my-project-12345`

- [ ] **NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET**
  - Description: Firebase Storage Bucket
  - Example: `my-project.appspot.com`

- [ ] **NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID**
  - Description: Firebase Messaging Sender ID
  - Example: `123456789012`

- [ ] **NEXT_PUBLIC_FIREBASE_APP_ID**
  - Description: Firebase App ID
  - Example: `1:123456789012:web:abc123def456`

- [ ] **NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID**
  - Description: Firebase Measurement ID (Google Analytics)
  - Example: `G-ABCDEF1234`

### Application Configuration

- [ ] **NEXT_PUBLIC_APP_URL**
  - Description: Public URL of the application
  - Example: `https://my-app.com`

- [ ] **NEXT_PUBLIC_SOCKETIO_SERVER_URL**
  - Description: Socket.IO server URL
  - Example: `https://my-app.com/socket.io`

- [ ] **NEXT_PUBLIC_YJS_SERVER_URL**
  - Description: Yjs server URL
  - Example: `https://my-app.com/yjs`

### GitHub OAuth Configuration

- [ ] **NEXT_PUBLIC_GITHUB_CLIENT_ID**
  - Description: GitHub OAuth Client ID
  - Example: `Iv1.abcdef1234567890`

## Verification

After adding all secrets, verify they are correctly configured:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see all 12 secrets listed
3. Secrets will show as `••••••••` for security

## Testing the Workflow

1. Make a small change to the repository
2. Commit and push to the `main` branch:
   ```bash
   git add .
   git commit -m "Test GKE deployment"
   git push origin main
   ```
3. Go to **Actions** tab in GitHub
4. Watch the "Deploy to GKE" workflow run
5. Check for any errors in the logs

## Troubleshooting

### Secret Not Found Error
- Double-check the secret name exactly matches (case-sensitive)
- Ensure the secret is added to the correct repository
- Verify the secret has a value (not empty)

### Authentication Failed
- Verify `GCP_SA_KEY` contains the complete JSON key
- Check the service account has the required permissions
- Ensure the service account is from the correct GCP project

### Firebase Configuration Error
- Verify all Firebase secrets are from the same Firebase project
- Check that the Firebase project is properly configured
- Ensure Firebase Authentication is enabled

### Database Connection Error
- Verify the database URL format is correct
- Check that the database is accessible from GKE
- Ensure database credentials are correct

## Security Best Practices

✅ **DO:**
- Rotate secrets regularly
- Use least-privilege service accounts
- Keep secrets confidential
- Use different secrets for different environments

❌ **DON'T:**
- Commit secrets to the repository
- Share secrets via email or chat
- Use the same secrets across multiple projects
- Log or print secret values

## Environment Variables Reference

| Secret Name | Used In | Purpose |
|-------------|---------|---------|
| GCP_PROJECT_ID | GitHub Actions | Identify GCP project |
| GCP_SA_KEY | GitHub Actions | Authenticate to GCP |
| NEXT_PUBLIC_FIREBASE_* | Next.js App | Firebase client config |
| DATABASE_URL | App + Server | Database connection |
| JWT_SECRET | App | Token signing |

## Next Steps

After configuring all secrets:
1. ✅ Review [GKE_DEPLOYMENT.md](../GKE_DEPLOYMENT.md)
2. ✅ Set up GKE cluster
3. ✅ Configure Kubernetes secrets
4. ✅ Push to main branch to trigger deployment
5. ✅ Monitor the deployment in GitHub Actions
