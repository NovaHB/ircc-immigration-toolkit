import json
import logging
import sys
import time

# Dedicated logger + explicit stdout handler so these lines are guaranteed to
# show up in Render's log stream regardless of however uvicorn/gunicorn has
# root logging configured (which often only wires up stderr).
logger = logging.getLogger("bq_timing")
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def run_timed_query(client, query, job_config):
    """Runs a BigQuery query, returning (rows, timings_ms).

    timings_ms:
      send_ms       - time for the client.query() call itself: building the
                       QueryJob and submitting it to BigQuery's API.
      bq_job_ms     - BigQuery's own reported job duration (job.ended -
                       job.started from the job's statistics) — actual
                       server-side execution time, not our wall clock.
      fetch_wall_ms - wall-clock time from job submission to all rows being
                       fetched locally. This is >= bq_job_ms; the gap is
                       network/polling/result-download overhead on top of
                       BigQuery's own execution time.
    """
    t0 = time.perf_counter()
    job = client.query(query, job_config=job_config)
    t1 = time.perf_counter()

    rows = list(job.result())
    t2 = time.perf_counter()

    bq_job_ms = None
    if job.started and job.ended:
        bq_job_ms = round((job.ended - job.started).total_seconds() * 1000, 1)

    return rows, {
        "send_ms": round((t1 - t0) * 1000, 1),
        "bq_job_ms": bq_job_ms,
        "fetch_wall_ms": round((t2 - t1) * 1000, 1),
    }


def time_json_dumps(payload) -> float:
    """Times JSON-serializing the response payload, in ms.

    Approximates (doesn't exactly equal) FastAPI's own serialization cost —
    it's the same json.dumps machinery, but FastAPI's jsonable_encoder does
    extra type coercion first. Close enough to tell whether serialization is
    a meaningful slice of total latency.
    """
    t0 = time.perf_counter()
    json.dumps(payload, default=str)
    t1 = time.perf_counter()
    return round((t1 - t0) * 1000, 1)


def log_timing(op: str, table: str, filters: dict, query_timings: dict, serialize_ms: float, total_ms: float) -> None:
    logger.info(
        "TIMING op=%s table=%s filters=%s send_ms=%s bq_job_ms=%s fetch_wall_ms=%s serialize_ms=%s total_ms=%s",
        op,
        table,
        filters,
        query_timings["send_ms"],
        query_timings["bq_job_ms"],
        query_timings["fetch_wall_ms"],
        serialize_ms,
        total_ms,
    )


def log_cache_hit(op: str, table: str, filters: dict, total_ms: float) -> None:
    logger.info("TIMING op=%s table=%s filters=%s CACHE_HIT total_ms=%s", op, table, filters, total_ms)
