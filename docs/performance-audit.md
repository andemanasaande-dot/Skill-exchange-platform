# SkillSwap performance audit

## Scope

Audited Prisma repositories, matching, pagination, notifications, message history, route loading, React Query usage, discovery search, and chat rendering. Existing ownership and participant predicates were retained in every optimization.

## Findings and changes

- Recommendations previously loaded every active user with every active skill and interest, then filtered in memory. The query now requires both reciprocal relationships in Prisma and caps candidates at 200 before running the matching algorithm.
- Skill discovery uses case-insensitive substring search. PostgreSQL trigram GIN indexes for title and description are included in the performance migration. The existing count and page response are retained for compatibility.
- Message history retains page pagination but also supports a base64url cursor over `(createdAt, id)`. Cursor requests avoid the total count and deep offset scan. Authorization is still checked before reading history. A composite message index supports the filtered order.
- Notifications retain their bounded page response and recipient predicate, with a composite `(recipientId, createdAt, id)` index matching the primary ordering.
- The client now lazy-loads route modules, including admin and chat pages. React Query has a 30-second stale time, five-minute garbage-collection time, disabled focus refetching, and one retry.
- Discovery search was already debounced at 350ms. Chat history remains capped at 100 messages by the existing API validation; cursor pagination is available for incremental history loading.

## Benchmark coverage

`server/src/__tests__/performance.discovery.test.ts` exercises matching against a 10,000-candidate fixture while the repository result is bounded to 200 candidates and asserts completion under two seconds. This is a CPU/regression guard, not a database benchmark.

A production PostgreSQL benchmark should run with representative data and:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ... FROM "Skill"
WHERE "isActive" = true AND "title" ILIKE '%javascript%'
ORDER BY "createdAt" DESC, "id" ASC
LIMIT 20;
```

Record p50/p95/p99 latency for skill discovery, recommendations, notification page 1/deep page, and message cursor/page requests. The target is p95 skill discovery below 2 seconds under normal production load. Apply the migration with `prisma migrate deploy` before measuring so the trigram and composite indexes exist.

## Remaining scale risks

- Offset pagination remains for legacy message, notification, request, and conversation consumers; cursor support should be rolled out client-side before those datasets become large.
- Chat currently renders the returned message set directly. A virtualization library should be introduced if conversations routinely exceed a few hundred visible messages.
- User-supplied remote avatars should be served through an image transformation/CDN policy when image volume warrants it; lazy loading and intrinsic dimensions are the next UI improvement.
