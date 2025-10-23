# GKE Deployment with SSL/TLS

## Prerequisites
- A domain name (configured: `rcce.yumeth.dev`)
- GCP project with GKE enabled
- kubectl configured for your cluster
- Domain DNS pointed to your cluster's Ingress IP

## Setup

### 1. Create GKE Cluster:
```bash
gcloud container clusters create rcce-cluster \
  --zone us-central1-a \
  --num-nodes 2 \
  --machine-type e2-small \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 3
```

### 2. Install NGINX Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml
```

Wait for the LoadBalancer to be ready:
```bash
kubectl get svc -n ingress-nginx -w
```

### 3. Install cert-manager (for SSL certificates)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

**GKE-Specific Configuration** (Required for GKE):
```bash
# Configure cert-manager to use its own namespace for leader election
# This avoids permission issues with GKE's managed kube-system namespace
# Note: The main cert-manager container is named "cert-manager-controller"
kubectl set env deployment/cert-manager -n cert-manager \
  --containers=cert-manager-controller \
  LEADER_ELECTION_NAMESPACE=cert-manager

kubectl set env deployment/cert-manager-cainjector -n cert-manager \
  --containers=cert-manager-cainjector \
  LEADER_ELECTION_NAMESPACE=cert-manager

kubectl set env deployment/cert-manager-webhook -n cert-manager \
  --containers=cert-manager-webhook \
  LEADER_ELECTION_NAMESPACE=cert-manager

# Wait for rollout to complete
kubectl rollout status deployment/cert-manager -n cert-manager
kubectl rollout status deployment/cert-manager-cainjector -n cert-manager
kubectl rollout status deployment/cert-manager-webhook -n cert-manager
```

Verify cert-manager installation:
```bash
kubectl get pods -n cert-manager

# Check for errors (should see no permission errors about kube-system)
kubectl logs -n cert-manager -l app=cert-manager --tail=50
```

**Wait 30-60 seconds** for cert-manager webhook to initialize before proceeding.

### 4. Configure Domain DNS

Get the NGINX Ingress LoadBalancer IP:
```bash
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Create an A record in your DNS provider:
```
Type: A
Name: rcce (or @ if using root domain)
Value: <INGRESS_EXTERNAL_IP>
TTL: 3600
```

**Important:** Wait for DNS propagation before proceeding (can take 5-60 minutes).

Verify DNS:
```bash
nslookup rcce.yumeth.dev
```

### 5. Update Email in cert-issuer.yaml

Edit `k8s/cert-issuer.yaml` and replace `YOUR_EMAIL@example.com` with your actual email address. This is required for Let's Encrypt notifications.

### 6. Create Secrets

Create the required secrets (see `secrets-template.yaml` for reference):
```bash
kubectl create secret generic database-config --from-literal=mongo-uri='your-mongo-uri'
kubectl create secret generic jwt-config --from-literal=secret='your-jwt-secret'
kubectl create secret generic smtp-config \
  --from-literal=host='smtp.gmail.com' \
  --from-literal=port='587' \
  --from-literal=user='your-email' \
  --from-literal=pass='your-password' \
  --from-literal=sender-email='your-email'
kubectl create secret generic gemini-config \
  --from-literal=api-key='your-api-key' \
  --from-literal=model-name='gemini-1.5-flash'
kubectl create secret generic github-oauth \
  --from-literal=client-id='your-client-id' \
  --from-literal=client-secret='your-client-secret'
```

### 7. Deploy

**Option A: Manual Deployment**
```bash
kubectl apply -k k8s/
```

**Option B: Via GitHub Actions**
- Configure GitHub Secrets (see `.github/SECRETS_AND_VARS.md`)
- Push to `main` branch - GitHub Actions handles deployment

### 8. Verify SSL Certificate

Check certificate status:
```bash
kubectl get certificate -A
kubectl describe certificate rcce-tls-cert
```

Check cert-manager logs if issues occur:
```bash
kubectl logs -n cert-manager -l app=cert-manager
```

The certificate should be issued within 5-10 minutes. Once ready, the status will show `READY: True`.

## Access

Your application will be accessible at: `https://rcce.yumeth.dev`

### Service Endpoints
- Main App: `https://rcce.yumeth.dev`
- Socket.IO: `https://rcce.yumeth.dev/socket.io`
- Yjs WebSocket: `wss://rcce.yumeth.dev/yjs`

### Check Ingress Status
```bash
kubectl get ingress app-ingress
kubectl describe ingress app-ingress
```

## SSL Certificate Management

### Certificate Auto-Renewal
Let's Encrypt certificates are valid for 90 days. cert-manager automatically renews them 30 days before expiry.

### Check Certificate Expiry
```bash
kubectl get certificate rcce-tls-cert -o jsonpath='{.status.notAfter}'
```

### Force Certificate Renewal
```bash
kubectl delete certificate rcce-tls-cert
kubectl apply -k k8s/
```

### Troubleshooting SSL Issues

1. **Certificate not issuing:**
```bash
kubectl get certificaterequest
kubectl describe certificaterequest <name>
kubectl get challenges
kubectl describe challenge <name>
```

2. **HTTP-01 challenge failing:**
   - Ensure DNS is properly configured
   - Check that port 80 is accessible
   - Verify ingress is routing correctly

3. **Use staging issuer for testing:**
   Edit `ingress.yaml` and change:
   ```yaml
   cert-manager.io/cluster-issuer: "letsencrypt-staging"
   ```
   Staging certificates won't be trusted by browsers but don't count against rate limits.

## Useful Commands

2. Create a ClusterIssuer for Let's Encrypt
3. Add TLS configuration to ingress.yaml

## Useful Commands

### View Resources
```bash
kubectl get pods
kubectl get services
kubectl get ingress
kubectl get configmap
```

### Logs
```bash
kubectl logs -l app=nextjs-app
kubectl logs -l app=socketio-server
kubectl logs -l app=yjs-server
kubectl logs -f <pod-name>  # Follow logs
```

### Debugging
```bash
kubectl describe pod <pod-name>
kubectl describe ingress app-ingress
kubectl get events --sort-by='.lastTimestamp'
```

### Scale Resources
```bash
kubectl scale deployment nextjs-app --replicas=3
kubectl scale deployment socketio-server --replicas=2
```

### Update Configuration
```bash
kubectl edit configmap app-config
kubectl rollout restart deployment/nextjs-app
```

## Monitoring

### Check Pod Status
```bash
kubectl get pods -w
```

### Check HPA Status
```bash
kubectl get hpa
```

### Resource Usage
```bash
kubectl top nodes
kubectl top pods
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

### Ingress not working
```bash
kubectl describe ingress app-ingress
# Check if the backend services are healthy
kubectl get endpoints
```

### DNS not resolving
- Verify A record is properly configured
- Wait for DNS propagation (can take up to 48 hours)
- Use `nslookup your-domain.com` to verify

### WebSocket connections failing
- Ensure session affinity is configured in services
- Check ingress annotations for WebSocket support
- Verify firewall rules allow WebSocket traffic
