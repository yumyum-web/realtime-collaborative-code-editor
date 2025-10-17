# GKE Deployment

## Setup

1. **Create GKE Cluster:**
```bash
gcloud container clusters create rcce-cluster \
  --zone us-central1-a \
  --num-nodes 2 \
  --machine-type e2-small \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 3
```

2. **Create Kubernetes Secrets:**
```bash
kubectl create secret generic database-config \
  --from-literal=mongo-uri=YOUR_MONGO_URI

kubectl create secret generic jwt-config \
  --from-literal=secret=YOUR_JWT_SECRET

kubectl create secret generic smtp-config \
  --from-literal=host=YOUR_SMTP_HOST \
  --from-literal=port=YOUR_SMTP_PORT \
  --from-literal=user=YOUR_SMTP_USER \
  --from-literal=pass=YOUR_SMTP_PASS \
  --from-literal=sender-email=YOUR_SENDER_EMAIL

kubectl create secret generic gemini-config \
  --from-literal=api-key=YOUR_GEMINI_API_KEY \
  --from-literal=model-name=gemini-2.0-flash

kubectl create secret generic github-oauth \
  --from-literal=client-id=YOUR_GITHUB_CLIENT_ID \
  --from-literal=client-secret=YOUR_GITHUB_CLIENT_SECRET
```

3. **Configure GitHub Secrets** (see `.github/SECRETS_SETUP.md`)

4. **Deploy:** Push to `main` branch - GitHub Actions handles deployment

## Access
Get the LoadBalancer IP: `kubectl get service nextjs-service`

## Useful Commands
```bash
kubectl get pods
kubectl logs -l app=nextjs-app
kubectl describe pod <pod-name>
```
