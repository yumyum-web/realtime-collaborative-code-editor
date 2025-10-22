# Quick Setup Summary for rcce.yumeth.dev

This is a condensed guide for deploying the Real-Time Collaborative Code Editor with SSL to GKE.

## ✅ Configuration Status

### Domain & SSL
- ✅ Domain: `rcce.yumeth.dev` (configured)
- ✅ SSL/TLS: Let's Encrypt with auto-renewal (configured)
- ✅ HTTPS redirect: Enabled (configured)
- ✅ WebSocket support: Enabled (configured)

### Kubernetes Resources
- ✅ NGINX Ingress Controller (auto-installed by workflow)
- ✅ cert-manager (auto-installed by workflow)
- ✅ ClusterIssuer (configured for Let's Encrypt)
- ✅ ConfigMap with domain URLs (configured)
- ✅ Ingress with TLS (configured)

### Applications
- ✅ Next.js app deployment
- ✅ Socket.IO server deployment
- ✅ Yjs WebSocket server deployment

## 🚀 Deployment Steps

### 1. Create GKE Cluster (One-time)

```bash
gcloud container clusters create rcce-cluster \
  --zone us-central1-a \
  --num-nodes 2 \
  --machine-type e2-small \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 3
```

### 2. Install NGINX Ingress & Get IP (One-time)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml

# Wait and get IP
kubectl get svc ingress-nginx-controller -n ingress-nginx -w
```

### 3. Configure DNS (One-time)

Create A record:
- **Name:** rcce.yumeth.dev
- **Type:** A
- **Value:** <INGRESS_EXTERNAL_IP>

Verify:
```bash
nslookup rcce.yumeth.dev
```

### 4. Configure GitHub Secrets & Variables

**Required Variables:**
- `GCP_PROJECT_ID`
- `GKE_CLUSTER` = `rcce-cluster`
- `GKE_REGION` = `us-central1-a`
- All Firebase variables
- `NEXT_PUBLIC_APP_URL` = `https://rcce.yumeth.dev`
- `NEXT_PUBLIC_SOCKETIO_SERVER_URL` = `https://rcce.yumeth.dev`
- `NEXT_PUBLIC_YJS_SERVER_URL` = `wss://rcce.yumeth.dev/yjs`
- `NEXT_PUBLIC_GITHUB_CLIENT_ID`

**Required Secrets:**
- `GCP_SA_KEY` (service account JSON)
- `MONGO_URI` (MongoDB connection string)
- `JWT_SECRET` (generate with: `openssl rand -base64 32`)

**Optional Secrets:**
- SMTP configuration
- Gemini API key
- GitHub OAuth

See `.github/SECRETS_AND_VARS.md` for details.

### 5. Update Email in cert-issuer.yaml

Edit `k8s/cert-issuer.yaml`:
```yaml
email: your-actual-email@example.com
```

### 6. Deploy

**Push to main branch:**
```bash
git add .
git commit -m "Deploy with SSL"
git push origin main
```

**OR manually trigger:**
- Go to Actions tab → Deploy to GKE → Run workflow

## 📊 What the Workflow Does

1. ✅ Builds and pushes 3 Docker images (Next.js, Socket.IO, Yjs)
2. ✅ Installs NGINX Ingress Controller (if not present)
3. ✅ Installs cert-manager (if not present)
4. ✅ Creates ConfigMap with domain configuration
5. ✅ Creates Kubernetes secrets from GitHub secrets
6. ✅ Deploys ClusterIssuer for Let's Encrypt
7. ✅ Deploys all 3 applications
8. ✅ Deploys Ingress with TLS configuration
9. ✅ Waits for SSL certificate issuance
10. ✅ Displays deployment status

## ⏱️ Expected Timeline

- First deployment: 30-90 minutes (includes DNS propagation)
- Subsequent deployments: 15-30 minutes
- Certificate issuance: 5-10 minutes

## ✅ Verification

### Check Deployment
```bash
kubectl get pods
kubectl get ingress app-ingress
kubectl get certificate rcce-tls-cert
```

### Test Application
```bash
# Test HTTPS
curl -I https://rcce.yumeth.dev

# Should return 200 OK with valid SSL
```

### Check Browser
Visit https://rcce.yumeth.dev and verify:
- ✅ Site loads over HTTPS
- ✅ Padlock icon shows secure connection
- ✅ Certificate issued by Let's Encrypt
- ✅ No SSL warnings

## 🐛 Quick Troubleshooting

### Certificate Not Issuing
```bash
kubectl describe certificate rcce-tls-cert
kubectl get challenges
kubectl logs -n cert-manager -l app=cert-manager --tail=50
```

**Common causes:**
- DNS not propagated → Wait longer
- DNS not pointing to correct IP → Check A record
- Port 80 blocked → Check firewall rules

### Pods Not Starting
```bash
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

**Common causes:**
- Image pull error → Check GCP permissions
- Missing secrets → Check GitHub secrets configured
- Resource limits → Check cluster capacity

### 502 Bad Gateway
```bash
kubectl get endpoints
kubectl logs -l app=nextjs-app
```

**Common causes:**
- Pods not ready → Wait for startup
- Health checks failing → Check pod logs
- Service misconfigured → Check service definition

## 📚 Files Changed

### New Files Created
- `k8s/configmap.yaml` - Domain configuration
- `k8s/cert-issuer.yaml` - Let's Encrypt setup
- `k8s/DEPLOYMENT_GUIDE.md` - Deployment instructions
- `k8s/SSL_SETUP.md` - SSL details
- `.github/SECRETS_AND_VARS.md` - Updated secrets guide

### Files Updated
- `k8s/ingress.yaml` - Added TLS and domain
- `k8s/nextjs-app-deployment.yaml` - Changed to ClusterIP
- `k8s/kustomization.yaml` - Added new resources
- `k8s/README.md` - Added SSL setup instructions
- `.github/workflows/deploy-gke.yml` - Added SSL automation

## 🔐 Security Notes

- SSL certificates auto-renew every 60 days
- All secrets encrypted in GitHub
- HTTPS enforced with automatic redirect
- WebSocket connections secured with WSS
- Service account has minimal required permissions

## 🎯 Access URLs

- **Main App:** https://rcce.yumeth.dev
- **Socket.IO:** https://rcce.yumeth.dev/socket.io
- **Yjs WebSocket:** wss://rcce.yumeth.dev/yjs

## 📞 Need Help?

1. Check GitHub Actions logs
2. Review pod logs: `kubectl logs <pod-name>`
3. Check cert-manager: `kubectl logs -n cert-manager -l app=cert-manager`
4. See detailed docs:
   - `.github/SECRETS_AND_VARS.md`
   - `k8s/README.md`
   - `k8s/SSL_SETUP.md`
   - `k8s/DEPLOYMENT_GUIDE.md`

## ✨ Features Enabled

- ✅ Automatic SSL certificate issuance
- ✅ Certificate auto-renewal (90 days → renews at 60 days)
- ✅ HTTP to HTTPS redirect
- ✅ WebSocket support over WSS
- ✅ Session affinity for WebSocket connections
- ✅ Horizontal pod autoscaling
- ✅ Health checks and readiness probes
- ✅ Resource limits and requests
- ✅ Multi-service routing
- ✅ Automatic rollout and rollback

## 🎉 You're All Set!

Once deployment completes, your application will be live at:
### https://rcce.yumeth.dev

With automatic SSL certificate management, secure WebSocket connections, and production-ready configuration!
