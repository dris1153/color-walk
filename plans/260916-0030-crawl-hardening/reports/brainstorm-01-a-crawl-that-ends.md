# Brainstorm: a crawl that ends, and says where it is

**Date:** 2026-09-16
**Trigger:** "khó nắm bắt status, lúc thì fail lúc thì bị pause vô thời hạn, chạy xong cũng không tự tắt"
**Outcome:** diagnosed from a live stalled process, four root causes fixed, verified on a real run.

## What was actually happening

Two crawls were running at once (started 22:39 and 23:04). One had exited; the
other, pid 29792, had used **72 s of CPU in ~24 h**. Its sockets:

```
45.60.83.20:443  SynSent   x3     <- Imperva, the Met's WAF: SYNs dropped, never answered
45.60.83.20:443  Established x2
```

`fetch` in `http-util.mjs` had **no timeout and no AbortSignal** (grep: none).
A dropped SYN never resolves, so three of the five thumbnail workers sat in
`SYN_SENT` for an hour, `Promise.all` never returned, and the process could
not exit. It was **99.97% done**: 89,814 of 89,843 thumbnails were on disk;
29 remained, 3 of them 404s.

`progress.json` was **64 minutes stale** because it was written only when an
item landed, so a stall and a slow stage looked identical. Its rate said
`1,379,544/min` because the thumbnail stage counted cache hits.

Ctrl+C had killed the npm wrapper; the child kept running, could not receive a
second Ctrl+C, and was waiting for an item that would never finish.

| Symptom | Root cause |
|---|---|
| Pause forever / never exits | no request deadline; a stalled socket holds a worker and the run |
| Second Ctrl+C does nothing | the child lost its console; and "finish the item in flight" is meaningless when it cannot finish |
| Status unreadable | progress written only on item completion; rate counted cache hits; no log survives the terminal |
| "Fails" | two crawls with no lock racing on progress.json and public/index |

## Fixed

1. **Deadline on every request.** `AbortSignal.timeout` - 30 s JSON, 60 s images; a timeout is retryable like a 5xx. `AbortSignal.any` combines it with the run's own signal.
2. **Pause aborts in flight.** `createControl` owns an `AbortController`; SIGINT or the `--minutes` deadline aborts every request. The run drains in milliseconds; the item in flight is retried next run, which the append-only cache makes free. An abort is never recorded as "gone" or "failed".
3. **Heartbeat.** Progress is written every 5 s on an `unref`'d timer with `inflight`, `lastAdvanceAt` and a network-only rate. `crawl:status` gives a verdict: running / SILENT / STALLED / NOT RUNNING / finished, and prints the last three log lines.
4. **Exit guaranteed.** `main()` ends in `process.exit`; `unhandledRejection` logs and exits 1; a lock refusal exits 2.
5. **Lock.** `.cache/crawl.lock` names its pid; a live owner refuses a second crawl, a dead one is taken over.
6. **Log.** Every line also goes to `.cache/crawl.log`, truncated past 5 MB.

## Verified on a real run

| Check | Result |
|---|---|
| A server that never answers | rejected with `timeout after 150ms` after one retry, in well under 5 s |
| Abort mid-request | rejected at once as AbortError, not retried, not mistaken for a timeout |
| Already-aborted signal | no request made at all |
| `crawl:status` on the live crawl | `running (pid 48856)`, heartbeat 0 s, rate `0/min over the network` (all cache hits - honest), log tail |
| Second `build:index` while one runs | **exit code 2**, `another crawl is running (pid 48856)` |
| Live sockets under WAF pressure | 4 Established, 1 SynSent - the SynSent now times out at 30 s |
| Tests | 254 (from 239) |

## Three things found while proving it

- **Test controls wrote into the real crawl.** `createControl` in a test used
  `log: quiet` but still appended to the real `crawl.log`, so twelve "pausing"
  lines appeared beside a live crawl that had never been paused - an hour went
  on a wrong theory that vitest was sending Ctrl+C to the console. Its sockets
  were churning the whole time: it was simply working through 45,942 HEADs.
  `createControl` now takes a `dir`, and tests pass a temp one.

- **The HEAD stage was a blind spot.** 45,942 HEADs at five a time is the longest stretch of a warm run, and it reported no progress and counted no inflight: status would have called it stalled for two hours. It is now its own stage, `sizes`, with a heartbeat.
- **My first lock test deleted the live crawl's lock.** It used the real lock path and cleared it in `afterEach`. The test now uses a temp path; the live crawl got its lock back by hand.

## Pending on this run finishing

The end-to-end exit-code proof, and `npm run verify:index` over the real
`twin` / `composition.json` / `words.json` / `spine.json` - this same run
produces them.
