# Quick Deployment Guide for rcce.yumeth.dev

This is a quick reference guide for deploying the Real-Time Collaborative Code Editor with SSL on GKE.

## Pre-deployment Checklist

- [ ] GKE cluster created and kubectl configured
- [ ] NGINX Ingress Controller installed
- [ ] cert-manager installed
- [ ] DNS A record created pointing rcce.yumeth.dev to Ingress IP
- [ ] DNS propagated (verify with `nslookup rcce.yumeth.dev`)
- [ ] Email updated in `k8s/cert-issuer.yaml`
- [ ] All secrets created

## Quick Start Commands

```bash
# 1. Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml

# 2. Wait for LoadBalancer and get IP
kubectl get svc ingress-nginx-controller -n ingress-nginx -w

# 3. Configure DNS with the LoadBalancer IP
# Create A record: rcce.yumeth.dev -> <EXTERNAL-IP>

# 4. Install cert-manager (GKE-compatible)
# Use this command for GKE to avoid kube-system permission issues
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Configure cert-manager for GKE (avoid kube-system namespace issues)
# Note: The cert-manager container is named "cert-manager-controller"
kubectl set env deployment/cert-manager -n cert-manager \
  --containers=cert-manager-controller \
  LEADER_ELECTION_NAMESPACE=cert-manager

kubectl set env deployment/cert-manager-cainjector -n cert-manager \
  --containers=cert-manager-cainjector \
  LEADER_ELECTION_NAMESPACE=cert-manager

kubectl set env deployment/cert-manager-webhook -n cert-manager \
  --containers=cert-manager-webhook \
  LEADER_ELECTION_NAMESPACE=cert-manager

# 5. Wait for cert-manager to be ready (IMPORTANT!)
kubectl rollout status deployment/cert-manager -n cert-manager
kubectl rollout status deployment/cert-manager-cainjector -n cert-manager
kubectl rollout status deployment/cert-manager-webhook -n cert-manager

# Give cert-manager webhook time to initialize its certificates
echo "Waiting 30 seconds for cert-manager webhook to initialize..."
sleep 30

# 6. Create secrets
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

# 7. Deploy application
kubectl apply -k k8s/

# 8. Monitor certificate issuance
kubectl get certificate -w
kubectl describe certificate rcce-tls-cert

# 9. Check deployment status
kubectl get pods
kubectl get ingress app-ingress
```

## Verification

```bash
# Check all resources
kubectl get all
kubectl get ingress
kubectl get certificate

# Test the application
curl -I https://rcce.yumeth.dev

# Check logs if issues occur
kubectl logs -l app=nextjs-app
kubectl logs -l app=socketio-server
kubectl logs -l app=yjs-server
kubectl logs -n cert-manager -l app=cert-manager
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

## Troubleshooting

### cert-manager webhook error (Common!)
If you see: `failed calling webhook "webhook.cert-manager.io"`:
```bash
# This is common when cert-manager was just installed
# Wait 30 seconds and retry:
sleep 30
kubectl apply -f k8s/cert-issuer.yaml
```
See `CERT_MANAGER_WEBHOOK_ERROR.md` for detailed troubleshooting.

### Certificate not issuing
```bash
kubectl get certificaterequest
kubectl describe certificaterequest <name>
kubectl get challenges
kubectl describe challenge <name>
```

### DNS not resolving
```bash
nslookup rcce.yumeth.dev
dig rcce.yumeth.dev
```

### Ingress not routing
```bash
kubectl describe ingress app-ingress
kubectl get endpoints
```

## Important Notes

- **cert-manager Initialization:** Wait 30-60 seconds after installation before applying ClusterIssuer
- **DNS Propagation:** Can take 5-60 minutes. Wait before deploying.
- **Certificate Issuance:** Takes 5-10 minutes after DNS is confirmed.
- **Rate Limits:** Let's Encrypt has rate limits. Use staging issuer for testing.
- **Port 80 Required:** HTTP-01 challenge requires port 80 to be accessible.
- **Auto-Renewal:** Certificates auto-renew 30 days before expiry.

## Access URLs

- **Main Application:** https://rcce.yumeth.dev
- **Socket.IO:** https://rcce.yumeth.dev/socket.io
- **Yjs WebSocket:** wss://rcce.yumeth.dev/yjs

## Next Steps After Deployment

1. Monitor pods and ensure all are running
2. Test WebSocket connections
3. Verify SSL certificate in browser
4. Set up monitoring and logging (optional)
5. Configure horizontal pod autoscaling if needed
