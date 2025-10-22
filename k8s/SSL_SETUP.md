# SSL Configuration

## What Happens After Deployment

1. **Ingress Creation:** Ingress resource is created with TLS configuration
2. **Certificate Request:** cert-manager detects the ingress and requests a certificate
3. **HTTP-01 Challenge:** Let's Encrypt validates domain ownership
4. **Certificate Issuance:** Certificate is issued and stored in secret `rcce-tls-cert`
5. **HTTPS Active:** Your site is accessible via HTTPS with auto-redirect

## Monitoring Certificate Issuance

```bash
# Watch certificate status
kubectl get certificate -w

# Check detailed status
kubectl describe certificate rcce-tls-cert

# View challenges
kubectl get challenges

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

## Expected Timeline

- **DNS Propagation:** 5-60 minutes
- **Certificate Issuance:** 5-10 minutes after DNS confirms
- **Total Setup Time:** 15-70 minutes

## Verification

Once deployed, verify:
```bash
# Test HTTPS
curl -I https://rcce.yumeth.dev

# Check certificate in browser
# Should show valid Let's Encrypt certificate
```

## Troubleshooting

### Certificate Stuck in Pending
1. Check DNS is properly configured
2. Ensure port 80 is accessible
3. Check challenges: `kubectl describe challenge <name>`

### 502 Bad Gateway
1. Check pods are running: `kubectl get pods`
2. Check service endpoints: `kubectl get endpoints`
3. Check pod logs

### SSL Certificate Warnings
- May occur during certificate issuance (5-10 min wait)
- If using staging issuer, browser will show warning (expected)

## Additional Resources

- [NGINX Ingress Controller Docs](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt Rate Limits](https://letsencrypt.org/docs/rate-limits/)

## Rate Limits (Let's Encrypt Production)

- 50 certificates per registered domain per week
- 5 duplicate certificates per week
- Use staging issuer for testing to avoid hitting limits

## Auto-Renewal

- Certificates valid for 90 days
- Auto-renewed 30 days before expiry
- No manual intervention required
