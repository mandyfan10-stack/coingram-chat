# Messenger QA and Supabase security report — 2026-07-23

## Automated and live checks

| Area | Result | Evidence |
| --- | --- | --- |
| Photo upload | Pass | Uploaded through the real file chooser; private Storage object and message were created. |
| Media after restart | Pass | A fresh authenticated client downloaded identical photo/audio/video bytes; the reloaded UI rendered image, audio, video and sticker without `Attachment unavailable`. |
| Stickers | Pass | Sticker message reloaded and the asset returned HTTP 200 with `image/webp`. |
| Two simultaneous users | Pass | Independent Supabase clients received a Postgres message event and a private Realtime call signal. |
| Foreign chats and messages | Pass | A non-member received zero rows. |
| Foreign Realtime call topic | Pass | Subscription ended with `CHANNEL_ERROR / Unauthorized`. |
| Message spoofing | Pass | Changing `sender_id` on an existing message was rejected by the database trigger. |
| Message rate limit | Pass | 25 messages in 10 seconds were accepted; the 26th was rejected. |
| Storage limits | Pass | 15 MiB + 1 byte and `application/pdf` were both rejected server-side. |
| Long conversation | Pass | Browser loaded 30, then 90, then all 105 messages while preserving scroll position. |
| Mobile portrait | Pass | 360×800, no horizontal overflow; composer remained visible. |
| Mobile landscape | Pass | 800×360, no horizontal overflow; composer remained visible. |
| Keyboard focus | Pass with limitation | Focused composer stayed inside `visualViewport`; an actual Android/iOS soft keyboard was not available in this desktop browser. |
| Offline queue | Code-path coverage only | Offline blob persistence/sync was reviewed and hardened, but the in-app browser exposes no network-offline emulation. A physical-device network-loss run remains recommended. |
| WebRTC | Signaling pass, media-device run pending | Private offer signaling passed between two users and foreign topics were blocked. A real microphone/camera peer-to-peer call across two physical devices remains recommended. |

## Security changes applied to production Supabase

- All public application tables retain RLS; Data API privileges are reduced to the columns and operations the client uses.
- Message identity/routing and chat identity/ownership are immutable.
- E2EE private-key backups were removed from the globally readable profile shape; public-key persistence is fixed.
- Private-channel metadata is hidden from non-members.
- Call signaling uses private, chat-scoped Realtime topics; public Realtime channels are disabled.
- Storage has a 15 MiB limit and explicit image/video/audio MIME allowlists.
- Auth passwords now require at least 10 characters with lowercase, uppercase, digits and symbols; secure password change and current-password verification are enabled.
- Auth sign-up/sign-in limit is 30 requests per 5 minutes per IP. Messages are limited to 25 per 10 seconds and 300 per 5 minutes per user.
- A JWT-protected Edge Function cleans only safely identifiable `msg_<uuid>` attachment orphans after 24 hours and unreferenced public media after 7 days. It runs daily with credentials stored in Vault.

## Remaining platform warning

**Update (owner, post-report):** Supabase plan upgraded and **leaked-password protection enabled**. Original note below is historical.

~~Supabase leaked-password protection is unavailable on the current Free plan.~~ The final security advisor had no other security warnings at report time. Existing unused-index notices are informational and should be reassessed after real production traffic rather than deleted immediately.

## Cleanup

All temporary QA users, chats, messages, memberships, read receipts and Storage objects created by this run were removed.