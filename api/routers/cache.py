import threading

from cachetools import TTLCache

# Data updates monthly, so a 24h TTL is conservative — the cache just speeds
# up repeat requests within a warm Render session. On Render's free tier the
# container restarts on cold start (sleep -> wake), which empties this cache;
# that's expected and is what the keep-alive workflow is for, not this.
_TTL_SECONDS = 24 * 60 * 60
_cache = TTLCache(maxsize=4096, ttl=_TTL_SECONDS)
_lock = threading.Lock()


def make_key(op: str, table: str, **params) -> str:
    """Builds a cache key from the operation, mart table, and every filter/
    pagination param — so different filter combos never collide."""
    parts = [op, table] + [f"{k}={v}" for k, v in sorted(params.items())]
    return "|".join(parts)


def cache_get(key: str):
    with _lock:
        return _cache.get(key)


def cache_set(key: str, value) -> None:
    with _lock:
        _cache[key] = value
