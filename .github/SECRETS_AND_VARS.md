# GitHub Secrets and Variables Configuration

This document lists all the GitHub Secrets and Variables needed for CI/CD deployment to GKE with SSL/TLS support.

## Repository Variables

Go to: **Settings → Secrets and variables → Actions → Variables**

### Google Cloud Platform Variables

| Variable Name    | Description                           | Example Value       | Required |
| ---------------- | ------------------------------------- | ------------------- | -------- |
| `GKE_CLUSTER`    | Google Kubernetes Engine cluster name | `rcce-cluster`      | ✅       |
| `GKE_REGION`     | GKE cluster region                    | `us-central1-a`     | ✅       |
| `GCP_PROJECT_ID` | Google Cloud Project ID               | `my-project-123456` | ✅       |

### Application Variables (Updated for SSL)

| Variable Name                     | Description                     | Value (Pre-configured)              | Required |
| --------------------------------- | ------------------------------- | ----------------------------------- | -------- |
| `NEXT_PUBLIC_APP_URL`             | Public URL of your application  | `https://rcce.yumeth.dev`           | ✅       |
| `NEXT_PUBLIC_SOCKETIO_SERVER_URL` | Public Socket.IO server URL     | `https://rcce.yumeth.dev/socket.io` | ✅       |
| `NEXT_PUBLIC_YJS_SERVER_URL`      | Public Yjs WebSocket server URL | `wss://rcce.yumeth.dev/yjs`         | ✅       |

### Firebase Variables

| Variable Name                              | Description                  | Required |
| ------------------------------------------ | ---------------------------- | -------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Firebase API Key             | ✅       |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase Auth Domain         | ✅       |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase Project ID          | ✅       |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Firebase Storage Bucket      | ✅       |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | ✅       |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Firebase App ID              | ✅       |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`      | Firebase Measurement ID      | ✅       |

### GitHub Variables

| Variable Name                  | Description                     | Required |
| ------------------------------ | ------------------------------- | -------- |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth Client ID (public) | ✅       |

## Repository Secrets

Go to: **Settings → Secrets and variables → Actions → Secrets**

### Required Secrets

| Secret Name  | Description                           | How to Get                                                        | Required |
| ------------ | ------------------------------------- | ----------------------------------------------------------------- | -------- |
| `GCP_SA_KEY` | Google Cloud Service Account JSON key | Create a service account in GCP with GKE/GCR permissions          | ✅       |
| `MONGO_URI`  | MongoDB connection string             | Your MongoDB Atlas or hosted MongoDB URI                          | ✅       |
| `JWT_SECRET` | Secret key for JWT token signing      | Generate a random secure string (e.g., `openssl rand -base64 32`) | ✅       |

### Optional Secrets (for additional features)

| Secret Name         | Description                                | Feature             | Required |
| ------------------- | ------------------------------------------ | ------------------- | -------- |
| `SMTP_HOST`         | SMTP server hostname                       | Email functionality | ⭕       |
| `SMTP_PORT`         | SMTP server port (e.g., 587)               | Email functionality | ⭕       |
| `SMTP_USER`         | SMTP authentication username               | Email functionality | ⭕       |
| `SMTP_PASS`         | SMTP authentication password               | Email functionality | ⭕       |
| `SENDER_EMAIL`      | Default sender email address               | Email functionality | ⭕       |
| `GEMINI_API_KEY`    | Google Gemini API key                      | AI chat assistant   | ⭕       |
| `GEMINI_MODEL_NAME` | Gemini model name (e.g., gemini-2.0-flash) | AI chat assistant   | ⭕       |
| `GH_CLIENT_ID`      | GitHub OAuth Client ID                     | GitHub login        | ⭕       |
| `GH_CLIENT_SECRET`  | GitHub OAuth Client Secret                 | GitHub login        | ⭕       |

## What the Workflow Does Automatically

The updated workflow (`deploy-gke.yml`) now includes:

1. ✅ **NGINX Ingress Controller Installation** - Automatically installs if not present
2. ✅ **cert-manager Installation** - Automatically installs if not present
3. ✅ **SSL Certificate Setup** - Deploys ClusterIssuer for Let's Encrypt
4. ✅ **Domain Configuration** - Pre-configured for `rcce.yumeth.dev`
5. ✅ **Certificate Monitoring** - Waits and verifies SSL certificate issuance
6. ✅ **All Three Services** - Builds and deploys Next.js, Socket.IO, and Yjs servers

## Setup Instructions

### 1. Add Variables

```bash
# Go to GitHub repository
# Settings → Secrets and variables → Actions → Variables tab
# Click "New repository variable" and add each required variable
```

**Required Variables:**

- `GCP_PROJECT_ID` - Your GCP project ID
- `GKE_CLUSTER` - Your GKE cluster name (e.g., `rcce-cluster`)
- `GKE_REGION` - Your GKE region (e.g., `us-central1-a`)
- All Firebase variables
- All NEXT*PUBLIC*\* variables (pre-configured for rcce.yumeth.dev)

### 2. Add Secrets

```bash
# Go to GitHub repository
# Settings → Secrets and variables → Actions → Secrets tab
# Click "New repository secret" and add each required secret
```

**Required Secrets:**

- `GCP_SA_KEY` - Service account JSON key
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret

**Optional Secrets:** (Add only if you need these features)

- SMTP configuration for email
- Gemini API for AI assistant
- GitHub OAuth for social login

### 3. Google Cloud Service Account Setup

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"

# Create a service account
gcloud iam service-accounts create github-actions \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions CI/CD"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Create and download the key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

# Copy the entire contents and add as GCP_SA_KEY secret
cat github-actions-key.json

# IMPORTANT: Delete the local key file after copying to GitHub
rm github-actions-key.json
```

### 4. Configure DNS for rcce.yumeth.dev

Before the first deployment, ensure your DNS is configured:

```bash
# After creating GKE cluster, install NGINX Ingress manually first
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml

# Wait and get the LoadBalancer IP
kubectl get svc ingress-nginx-controller -n ingress-nginx -w
```

Create an A record in your DNS provider:

- **Type:** A
- **Name:** rcce (or @ for root)
- **Value:** <INGRESS_EXTERNAL_IP>
- **TTL:** 3600

**Wait for DNS propagation before deploying:**

```bash
nslookup rcce.yumeth.dev
```

### 4. Generate JWT Secret

```bash
# Generate a random secure string
openssl rand -base64 32
# Copy the output and add it as JWT_SECRET secret
```

## Pre-Deployment Checklist

Before triggering the workflow:

- [ ] All required GitHub variables are configured
- [ ] All required GitHub secrets are configured
- [ ] GKE cluster is created and running
- [ ] DNS A record is created and pointing to Ingress IP
- [ ] DNS propagation is complete (verify with `nslookup rcce.yumeth.dev`)
- [ ] MongoDB is accessible from GKE (check network/firewall rules)
- [ ] Email in `k8s/cert-issuer.yaml` is updated

## Triggering the Deployment

### Option 1: Automatic Deployment

Push to the `main` branch:

```bash
git add .
git commit -m "Deploy to GKE"
git push origin main
```

### Option 2: Manual Deployment

1. Go to **Actions** tab in GitHub
2. Select **Deploy to GKE** workflow
3. Click **Run workflow**
4. Select branch `main` and click **Run workflow**

## Monitoring the Deployment

### In GitHub Actions

1. Go to **Actions** tab
2. Click on the running workflow
3. Watch each step's progress

### Key Steps to Watch:

1. ✅ Build and push Docker images
2. ✅ Install NGINX Ingress Controller
3. ✅ Install cert-manager
4. ✅ Deploy applications
5. ✅ Wait for certificate issuance (5-10 minutes)

### In Kubernetes

```bash
# Watch pods starting
kubectl get pods -w

# Check certificate status
kubectl get certificate rcce-tls-cert

# Check ingress
kubectl get ingress app-ingress

# View logs
kubectl logs -l app=nextjs-app --tail=50
```

## Verification

After deployment completes:

### 1. Check Application Access

```bash
# Test HTTPS
curl -I https://rcce.yumeth.dev

# Should return 200 OK with valid SSL certificate
```

### 2. Check SSL Certificate

- Visit https://rcce.yumeth.dev in your browser
- Click the padlock icon
- Verify the certificate is issued by Let's Encrypt
- Check expiry date (should be ~90 days from now)

### 3. Check All Services

```bash
kubectl get all
kubectl get certificate
kubectl get ingress
```

### 4. Test WebSocket Connections

- Socket.IO: https://rcce.yumeth.dev/socket.io
- Yjs: wss://rcce.yumeth.dev/yjs

## Troubleshooting

### Build Failures

**Image build failed:**

```bash
# Check Dockerfile syntax
docker build -f apps/nextjs-app/Dockerfile .

# Check build args are correct
docker build --build-arg NEXT_PUBLIC_APP_URL=https://rcce.yumeth.dev -f apps/nextjs-app/Dockerfile .
```

### Authentication Issues

**GCP authentication failed:**

- Verify `GCP_SA_KEY` is valid JSON (not truncated)
- Check service account has correct permissions
- Ensure GKE cluster exists in specified region

### Certificate Issues

**Certificate not issuing:**

```bash
# Check certificate request
kubectl get certificaterequest
kubectl describe certificaterequest <name>

# Check challenges
kubectl get challenges
kubectl describe challenge <name>

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

**Common causes:**

- DNS not pointing to Ingress IP
- DNS not yet propagated (wait 5-60 minutes)
- Port 80 not accessible for HTTP-01 challenge
- Rate limit hit (use staging issuer for testing)

### Deployment Issues

**Pods not starting:**

```bash
# Check pod status
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name>

# Common issues:
# - Image pull errors (check GCR permissions)
# - Missing secrets (check secrets exist)
# - Resource limits (check cluster capacity)
```

**Service not accessible:**

```bash
# Check service and endpoints
kubectl get svc
kubectl get endpoints

# Check ingress
kubectl describe ingress app-ingress

# Check NGINX ingress logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=100
```

## Notes

- ✅ **Workflow is fully automated** - Handles NGINX Ingress, cert-manager, and SSL setup
- ✅ **SSL certificates auto-renew** - cert-manager handles renewal 30 days before expiry
- ⚠️ **DNS must be configured first** - Point rcce.yumeth.dev to Ingress IP before deployment
- ⚠️ **Certificate takes 5-10 minutes** - Workflow waits for issuance automatically
- ⚠️ **Required secrets must be configured** - Application won't work without them
- ⚠️ **Optional secrets** - Application works with reduced functionality if not configured
- 🔒 **Secrets are encrypted** - Not visible after creation in GitHub
- 👁️ **Variables are visible** - Anyone with repository access can see them
- 📝 **Email in cert-issuer.yaml** - Must be updated before deployment
- 🔄 **Automatic rollback** - If deployment fails, previous version remains running

## Rate Limits

### Let's Encrypt Production

- 50 certificates per registered domain per week
- 5 duplicate certificates per week

### For Testing

Use staging issuer to avoid rate limits:

1. Edit `k8s/ingress.yaml`
2. Change annotation:
   ```yaml
   cert-manager.io/cluster-issuer: "letsencrypt-staging"
   ```
3. Note: Staging certificates will show browser warnings (expected)

## Security Best Practices

1. 🔐 **Never commit secrets to repository**
2. 🔄 **Rotate secrets regularly** (every 90 days)
3. 🎯 **Use least-privilege permissions** for service accounts
4. 👥 **Limit access** to GitHub repository settings
5. 📊 **Monitor service account usage** in GCP Console
6. 🔍 **Audit access logs** regularly
7. 🗑️ **Delete local key files** after uploading to GitHub
8. 🔒 **Enable 2FA** on GitHub account

## Additional Resources

- [GitHub Actions Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GCP Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt Rate Limits](https://letsencrypt.org/docs/rate-limits/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)

## Getting Help

If you encounter issues:

1. Check GitHub Actions logs for error messages
2. Review Kubernetes pod logs: `kubectl logs <pod-name>`
3. Check cert-manager logs: `kubectl logs -n cert-manager -l app=cert-manager`
4. Verify DNS configuration: `nslookup rcce.yumeth.dev`
5. Review the troubleshooting section above
6. Check the k8s/README.md for detailed commands

## Expected Deployment Timeline

| Step                     | Time       |
| ------------------------ | ---------- |
| Build Docker images      | 5-10 min   |
| Install NGINX Ingress    | 2-3 min    |
| Install cert-manager     | 2-3 min    |
| Deploy applications      | 2-3 min    |
| DNS propagation (if new) | 5-60 min   |
| Certificate issuance     | 5-10 min   |
| **Total (first time)**   | ~30-90 min |
| **Total (subsequent)**   | ~15-30 min |

## Post-Deployment

After successful deployment:

1. ✅ Application accessible at https://rcce.yumeth.dev
2. ✅ SSL certificate automatically issued and installed
3. ✅ HTTP traffic automatically redirects to HTTPS
4. ✅ WebSocket connections work over WSS
5. ✅ Certificate auto-renewal configured
6. ✅ Horizontal pod autoscaling enabled
7. ✅ Health checks and probes configured

Next steps:

- Set up monitoring (Cloud Monitoring/Prometheus)
- Configure alerting for certificate expiry
- Enable Cloud Logging for centralized logs
- Set up backup procedures for MongoDB
- Configure CI/CD for other branches/environments
