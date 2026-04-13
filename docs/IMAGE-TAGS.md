# Image Tags

Snapshot date: 2026-04-11

This project’s combined image can be built against different upstream Uptime Kuma base tags via:

- `UPTIME_KUMA_TAG`

Default:

- `UPTIME_KUMA_TAG=2.2.1`

Current practical difference

`2`
- Full Uptime Kuma v2 image
- Includes embedded Chromium for browser-based monitors
- Includes embedded MariaDB support
- Larger image size

`2-slim`
- Slimmer Uptime Kuma v2 image
- Does not include embedded Chromium
- Does not include embedded MariaDB
- Smaller image size

What this means for the bridge

- The REST bridge itself does not fundamentally change between `2` and `2-slim`
- The difference is in what Uptime Kuma features are available inside the combined container

When to use `2`

- You want browser-engine / Chromium-based monitor support
- You want the safer default for general users
- You prefer feature completeness over image size

When to use `2-slim`

- You only need normal HTTP/TCP/ping/DNS/push-style monitoring
- You want a smaller image
- You do not need embedded Chromium or embedded MariaDB

Recommendation for publishing

- Default to `2`
- Let advanced users pin `2-slim` or another explicit tag with `UPTIME_KUMA_TAG`

