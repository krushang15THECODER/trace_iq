import { IngestionInput } from '../services/ingestion.js';
import { IncidentRecord } from '../types/index.js';

export interface GroundTruthScenario {
  incident: IncidentRecord;
  sources: IngestionInput[];
  unanswerableQuestion: string;
  groundTruthCause: {
    rootCauseCategory: string;
    description: string;
    keyMetric: string;
    refutedCompetingHypothesis: string;
    outdatedSourceId: string;
  };
}

export const SYNTHETIC_INCIDENT: IncidentRecord = {
  _id: 'INC-2024-0882',
  title: 'Checkout API Latency Spike & Cascading Connection Pool Exhaustion under Concurrent Load',
  description:
    'During the Fall Promotional Flash Campaign on 2024-10-14, checkout API p99 latency spiked from 180ms to over 8,500ms, triggering cascading HTTP 504 Gateway Timeouts across checkout and cart services.',
  incidentDate: '2024-10-14T14:15:00Z',
  severity: 'SEV-1',
  associatedSourceIds: [],
  status: 'resolved',
  tags: ['checkout', 'latency', 'database', 'connection-pool', 'sev-1', 'hikari'],
  serviceAffected: 'checkout-service'
};

export const SYNTHETIC_SOURCES: IngestionInput[] = [
  {
    title: 'Checkout Service Architecture & Data Access Topology',
    sourceType: 'architecture',
    originalFilename: 'ARCH-CHECKOUT-SERVICE.md',
    documentVersion: '2.4.0',
    metadata: {
      service: 'checkout-service',
      author: 'Core Platform Architecture Team',
      date: '2024-08-20'
    },
    content: `# Checkout Service Architecture & Data Access Topology

## 1. System Overview
The Checkout Service manages the end-to-end customer checkout lifecycle, handling cart validation, order placement, tax computation, and payment dispatch.

## 2. Ingress & Concurrency
The service is deployed in Kubernetes with 8 replicas behind an AWS Application Load Balancer.
Each pod runs a Node.js / Spring Boot hybrid container servicing incoming requests via thread-pool executors.

## 3. Database Connection Management
The service connects to the primary transactional MongoDB/PostgreSQL database using HikariCP connection pooling.
Default pool configuration parameters in application.properties:
- spring.datasource.hikari.maximum-pool-size: 10
- spring.datasource.hikari.minimum-idle: 5
- spring.datasource.hikari.connection-timeout: 5000ms
- spring.datasource.hikari.idle-timeout: 600000ms
- spring.datasource.hikari.max-lifetime: 1800000ms

Notice: The maximum-pool-size is currently capped at 10 connections per pod to protect downstream database CPU during normal operational loads (under 800 req/sec total).

## 4. Downstream Dependencies
- Payment Gateway Service (External REST API, standard timeout 10000ms)
- Inventory Service (gRPC, standard timeout 2000ms)
- Order Notification Service (Kafka event publisher, async)`
  },
  {
    title: 'Payment Gateway Integration Specification & SLA',
    sourceType: 'api_doc',
    originalFilename: 'API-PAYMENT-GATEWAY.md',
    documentVersion: '3.1.0',
    metadata: {
      service: 'payment-integration',
      author: 'Fintech Integrations Team',
      date: '2024-09-01'
    },
    content: `# Payment Gateway Integration Specification & SLA

## 1. Interface Details
Endpoint: POST /v1/charges
Protocol: HTTPS / TLS 1.3
Payload Format: JSON

## 2. Service Level Agreement (SLA)
- Target Latency (p50): 110ms
- Target Latency (p99): 240ms
- Hard Timeout: 10000ms
- Expected Success Rate: > 99.98%

## 3. Status Code Contract
- 200 OK: Charge successful
- 400 Bad Request: Invalid card token or payload format
- 402 Payment Required: Card declined or insufficient funds
- 504 Gateway Timeout: Upstream gateway failure (requires idempotency check before retry)

During healthy operation, payment authorization completes in under 180ms. The payment gateway does not interact with the merchant database connection pool.`
  },
  {
    title: 'Incident Post-Mortem: INC-2024-0882 Checkout Latency Surge',
    sourceType: 'incident_report',
    originalFilename: 'INC-2024-0882-POSTMORTEM.md',
    documentVersion: '1.0.0',
    metadata: {
      service: 'checkout-service',
      incidentDate: '2024-10-14',
      author: 'Incident Response Commander',
      severity: 'SEV-1'
    },
    content: `# Incident Post-Mortem: INC-2024-0882
**Title:** Checkout API Latency Spike & Cascading Connection Pool Exhaustion
**Date:** 2024-10-14
**Duration:** 14:15 UTC to 15:00 UTC (45 minutes)
**Severity:** SEV-1

## Incident Timeline
- 14:10 UTC: Promotional flash campaign email sent to 1.2M users.
- 14:15 UTC: Checkout traffic surged from 450 req/sec baseline to 4,800 req/sec peak.
- 14:18 UTC: P99 latency on /api/v2/checkout jumped from 190ms to 8,400ms.
- 14:20 UTC: PagerDuty alert fired: HighHTTP5xxErrorRate (rate > 22%).
- 14:25 UTC: Incident response team convened on bridge. Initial suspicion focused on payment gateway timeouts.
- 14:32 UTC: Telemetry review confirmed external payment gateway p99 response time remained flat at 135ms.
- 14:38 UTC: Inspection of database metrics revealed HikariCP active connections pegged at 10/10 with 68 threads blocked waiting for connections. Average wait time reached 5,000ms, triggering ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54.
- 14:45 UTC: Hotfix deployment initiated: maximum-pool-size increased from 10 to 35.
- 15:00 UTC: Hotfix rolled out across all 8 pods. Connection wait time dropped to 3ms. Latency normalized to 165ms. Incident resolved.

## Root Cause
A deliberately restricted database connection pool limit (maximum-pool-size: 10 per pod) proved insufficient under concurrent traffic spikes. Incoming checkout requests blocked on acquiring database connections, exhausting the 5,000ms acquisition timeout and cascading into HTTP 504 timeouts.`
  },
  {
    title: 'Database Performance Metrics Snapshot: 2024-10-14',
    sourceType: 'db_metrics',
    originalFilename: 'DB-PERF-METRICS-20241014.csv',
    documentVersion: '1.0.0',
    metadata: {
      service: 'checkout-service',
      incidentDate: '2024-10-14',
      sampleRate: '1 minute'
    },
    content: `timestamp,service,active_connections,pool_size,waiting_threads,acquisition_wait_ms,cpu_utilization_pct,query_latency_ms
2024-10-14T14:10:00Z,checkout-service,4,10,0,2.1,18.4,14.2
2024-10-14T14:14:00Z,checkout-service,7,10,0,4.8,24.1,16.0
2024-10-14T14:16:00Z,checkout-service,10,10,14,340.5,38.2,28.4
2024-10-14T14:18:00Z,checkout-service,10,10,52,4890.0,42.1,31.2
2024-10-14T14:20:00Z,checkout-service,10,10,68,5002.0,43.0,32.0
2024-10-14T14:25:00Z,checkout-service,10,10,74,5000.0,41.8,30.5
2024-10-14T14:35:00Z,checkout-service,10,10,71,5001.0,44.2,29.8
2024-10-14T14:55:00Z,checkout-service,10,10,58,4950.0,42.7,30.1
2024-10-14T15:02:00Z,checkout-service,22,35,0,3.4,36.5,18.2
2024-10-14T15:10:00Z,checkout-service,18,35,0,2.8,29.1,15.6`
  },
  {
    title: 'Checkout Service Application Logs: 2024-10-14 14:18-14:22 UTC',
    sourceType: 'log',
    originalFilename: 'APP-LOGS-OCT14.log',
    documentVersion: '1.0.0',
    metadata: {
      service: 'checkout-service',
      incidentDate: '2024-10-14',
      logStream: 'stdout'
    },
    content: `2024-10-14T14:18:02.104Z [checkout-service-pod-3] INFO c.t.c.CheckoutController - Received order request [orderId=ord_994821]
2024-10-14T14:18:05.412Z [checkout-service-pod-3] WARN com.zaxxer.hikari.pool.HikariPool - HikariPool-1 - Connection is not available, request timed out after 5002ms. (total=10, active=10, idle=0, waiting=53)
2024-10-14T14:18:05.415Z [checkout-service-pod-3] ERROR c.t.c.OrderProcessor - Failed to acquire database connection for order ord_994821. Error code: ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54. Details: PoolAcquireTimeoutException: HikariPool-1 - Connection acquisition wait exceeded 5000ms.
2024-10-14T14:18:05.418Z [checkout-service-pod-3] ERROR c.t.c.GlobalExceptionHandler - Returning HTTP 504 Gateway Timeout to client for request /api/v2/checkout
2024-10-14T14:19:12.883Z [checkout-service-pod-1] WARN com.zaxxer.hikari.pool.HikariPool - HikariPool-1 - Connection is not available, request timed out after 5000ms. (total=10, active=10, idle=0, waiting=61)
2024-10-14T14:19:12.885Z [checkout-service-pod-1] ERROR c.t.c.OrderProcessor - Failed to acquire database connection for order ord_994888. Error code: ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54.
2024-10-14T14:20:01.321Z [checkout-service-pod-5] WARN com.zaxxer.hikari.pool.HikariPool - HikariPool-1 - Connection is not available, request timed out after 5001ms. (total=10, active=10, idle=0, waiting=74)
2024-10-14T14:20:01.324Z [checkout-service-pod-5] ERROR c.t.c.OrderProcessor - Error code: ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54. Returning 504 Gateway Timeout.`
  },
  {
    title: 'Service Deployment History: October 2024',
    sourceType: 'deployment',
    originalFilename: 'DEPLOYMENTS-OCT2024.csv',
    documentVersion: '1.0.0',
    metadata: {
      service: 'checkout-service',
      environment: 'production'
    },
    content: `deployment_id,service,version,deployed_at,deployed_by,git_commit,change_summary,status
DEP-8801,checkout-service,v2.4.0,2024-10-08T09:30:00Z,alice@traceiq.internal,a1f49e1,Update cart calculation logic,SUCCESS
DEP-8842,checkout-service,v2.4.1,2024-10-12T14:00:00Z,bob@traceiq.internal,7b8c230,Cap database pool size to 10 for resource throttling,SUCCESS
DEP-8899,checkout-service,v2.4.2-hotfix,2024-10-14T14:52:00Z,oncall-commander,9f01bc4,Increase HikariCP maximumPoolSize to 35 to resolve INC-2024-0882,SUCCESS`
  },
  {
    title: 'SRE Runbook: Database Connection Pool Sizing and Saturation Recovery',
    sourceType: 'runbook',
    originalFilename: 'SRE-RUNBOOK-POOL-TUNING.md',
    documentVersion: '2.1.0',
    metadata: {
      service: 'checkout-service',
      author: 'Reliability Engineering Team',
      date: '2024-05-15'
    },
    content: `# SRE Runbook: Database Connection Pool Sizing & Recovery

## Diagnostic Procedure for Pool Saturation
When experiencing p99 latency spikes accompanied by PoolAcquireTimeoutException:
1. Inspect HikariCP pool metrics:
   - hikaricp_connection_acquired_nanos
   - hikaricp_connection_pending_threads
   - hikaricp_active_connections
2. If active connections equal maximum-pool-size and pending threads > 0, the pool is saturated.
3. Verify database host CPU utilization before expanding pool size. If database CPU is under 60%, pool size can be safely expanded.
4. Formula for pool sizing: Pool Size = (Core Count * 2) + Spindle Count.`
  },
  {
    title: 'LEGACY ARCHIVE: Outdated Runbook on Checkout Latency (2021)',
    sourceType: 'runbook',
    originalFilename: 'OLD-SRE-RUNBOOK-2021.md',
    documentVersion: '1.0.0-DEPRECATED',
    isOutdated: true,
    metadata: {
      service: 'checkout-service',
      author: 'Former DevOps Lead',
      date: '2021-03-10',
      isOutdated: true,
      deprecationNote: 'SUPERSEDED BY SRE-RUNBOOK-POOL-TUNING.md (v2.1). DO NOT USE FOR TRIAGE.'
    },
    content: `# [DEPRECATED - 2021] SRE Runbook: Checkout Latency Troubleshooting

WARNING: This document is preserved for historical auditing purposes only. It reflects legacy infrastructure from 2021 and has been superseded.

Legacy Rule of Thumb:
Whenever checkout API latency increases or returns HTTP 504 timeouts, it is almost exclusively caused by external payment gateway downtime or latency degradation with Stripe/PayPal.
Do NOT modify database connection pool settings, as the database is never the bottleneck in our microservice architecture.`
  }
];

export const SYNTHETIC_GROUND_TRUTH: GroundTruthScenario = {
  incident: SYNTHETIC_INCIDENT,
  sources: SYNTHETIC_SOURCES,
  unanswerableQuestion: 'What was the memory utilization and eviction rate on the Redis cache cluster during the incident?',
  groundTruthCause: {
    rootCauseCategory: 'database_connection_pool_exhaustion',
    description:
      'Database connection pool limit (maximumPoolSize: 10) was saturated by concurrent load (4800 req/sec), causing threads to exceed the 5000ms acquisition timeout (ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54) and return HTTP 504.',
    keyMetric: 'HikariCP active connections pegged at 10/10 with 68 waiting threads and 5002ms acquisition timeout',
    refutedCompetingHypothesis: 'External payment gateway outage',
    outdatedSourceId: 'OLD-SRE-RUNBOOK-2021.md'
  }
};
