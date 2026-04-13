ARG UPTIME_KUMA_TAG=2.2.1
FROM ghcr.io/louislam/uptime-kuma:${UPTIME_KUMA_TAG}

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends supervisor curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/kuma-bridge

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/start-bridge.sh /usr/local/bin/start-bridge.sh
RUN chmod +x /usr/local/bin/start-bridge.sh

EXPOSE 3001 9911

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=10 \
    CMD curl -fsS http://127.0.0.1:9911/api/health >/dev/null && curl -fsS http://127.0.0.1:3001/ >/dev/null

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
