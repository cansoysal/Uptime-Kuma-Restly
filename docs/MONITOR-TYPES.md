# Monitor Types

Snapshot date: 2026-04-12

This document lists the Uptime Kuma monitor types currently modeled by this bridge and the minimum required fields for `/api/monitors/add`.

For `/api/monitors/edit`, the bridge merges the patch into the existing monitor and validates the final merged payload against the same rules.

## Base Rules

- Send monitor data as `{"monitor": {...}}` to `POST /api/monitors/add`
- Send monitor data as `{"monitor_id": 42, "monitor": {...}}` to `POST /api/monitors/edit`
- `monitor.type` selects the monitor model
- Push monitors get an auto-generated `pushToken` if you omit it

## Required Fields By Type

| Monitor Type | Required Fields |
|-------------|-----------------|
| `http` | `url` |
| `keyword` | `url`, `keyword` |
| `json-query` | `url`, `jsonPath`, `jsonPathOperator`, `expectedValue` |
| `port` | `hostname`, `port` |
| `ping` | `hostname` |
| `dns` | `hostname`, `dns_resolve_server`, `port` |
| `docker` | `docker_container`, `docker_host` |
| `system-service` | `system_service_name` |
| `real-browser` | `url` |
| `group` | no extra type-specific fields |
| `push` | no extra type-specific fields |
| `manual` | no extra type-specific fields |
| `globalping` + `subtype: "ping"` | `subtype`, `hostname`, `protocol` |
| `globalping` + `subtype: "http"` | `subtype`, `url`, `protocol` |
| `globalping` + `subtype: "dns"` | `subtype`, `hostname`, `port`, `protocol` |
| `grpc-keyword` | `grpcUrl`, `keyword`, `grpcServiceName`, `grpcMethod` |
| `kafka-producer` | `kafkaProducerBrokers`, `kafkaProducerTopic`, `kafkaProducerMessage` |
| `mqtt` | `hostname`, `mqttTopic` |
| `mqtt` with `mqttCheckType: "json-query"` | `hostname`, `mqttTopic`, `jsonPath`, `expectedValue` |
| `rabbitmq` | `rabbitmqNodes`, `rabbitmqUsername`, `rabbitmqPassword` |
| `sip-options` | `hostname`, `port` |
| `smtp` | `hostname`, `port` |
| `snmp` | `hostname`, `port`, `radiusPassword`, `snmpOid`, `jsonPath`, `jsonPathOperator`, `expectedValue` |
| `snmp` with `snmpVersion: "3"` | all SNMP fields above plus `snmpV3Username` |
| `tailscale-ping` | `hostname` |
| `websocket-upgrade` | `url` |
| `sqlserver` | `databaseConnectionString` |
| `mongodb` | `databaseConnectionString` |
| `mysql` | `databaseConnectionString` |
| `oracledb` | `databaseConnectionString`, `basic_auth_user`, `basic_auth_pass` |
| `postgres` | `databaseConnectionString` |
| `radius` | `hostname`, `port`, `radiusUsername`, `radiusPassword`, `radiusSecret`, `radiusCalledStationId`, `radiusCallingStationId` |
| `redis` | `databaseConnectionString` |
| `gamedig` | `hostname`, `port`, `game` |
| `steam` | `hostname`, `port` |

## Conditional Required Fields

### HTTP-family auth

For `http`, `keyword`, `json-query`, and `globalping` with `subtype: "http"`:

| Condition | Required Fields |
|----------|-----------------|
| `authMethod: "mtls"` | `tlsCert`, `tlsKey` |
| `authMethod: "oauth2-cc"` | `oauth_token_url`, `oauth_client_id`, `oauth_client_secret` |

### Kafka AWS SASL

For `kafka-producer` with `kafkaProducerSaslOptions.mechanism: "aws"`:

| Condition | Required Fields |
|----------|-----------------|
| AWS SASL | `kafkaProducerSaslOptions.authorizationIdentity`, `kafkaProducerSaslOptions.accessKeyId`, `kafkaProducerSaslOptions.secretAccessKey` |

## Source Basis

This mapping was derived from the current Uptime Kuma source:

- `server/uptime-kuma-server.js`
- `server/server.js`
- `server/model/monitor.js`
- `src/pages/EditMonitor.vue`

