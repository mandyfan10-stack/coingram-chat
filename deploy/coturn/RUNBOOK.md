# Coiny TURN runbook

This directory is preparation only; do not deploy until a server, DNS name, TLS certificate, firewall policy, monitoring and budget exist.

1. Replace `turn.example.com`, install a valid TLS certificate and generate two independent high-entropy secrets: the coturn REST shared secret and healthcheck secret.
2. Open TCP/UDP 3478, TCP/UDP 5349 and UDP 49160–49260. Keep the admin CLI disabled.
3. Put the same REST secret in `turnserver.conf` and the Supabase Edge secret `TURN_SHARED_SECRET`; set `TURN_URLS=turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp`.
4. Start with `systemctl enable --now coiny-coturn`, confirm the container healthcheck, TLS chain and an external relay-only WebRTC test.
5. Rotate by adding the new secret to coturn during a short overlap, update the Edge secret, wait longer than the 10-minute credential TTL, then remove the old secret. Record the rotation and rollback point.
6. Alert on healthcheck failures, allocation errors, bandwidth saturation, certificate expiry and unexpected geographic traffic. Retain no usernames or session IP logs beyond the operational minimum.

The client remains STUN-only when the Edge Function reports TURN unavailable. Once credentials are configured, relay-only is the default; direct connectivity requires an explicit user setting.
