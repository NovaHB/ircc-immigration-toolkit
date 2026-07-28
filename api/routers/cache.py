import threading

from cachetools import TTLCache

# Data updates monthly, so a 24h TTL is conservative — the cache just speeds
# up repeat requests within a warm Render session. On Render's free tier the
# container restarts on cold start (sleep -> wake), which empties this cache;
# that's expected and is what the keep-alive workflow is for, not this.
#
# maxsize=50000: the real filter-key space (province x year x month/category
# x dimension, across 13 mart tables, for the top_summary/trend ops alone) is
# already ~70k combinations — well past the old 4096 cap, causing eviction
# under completely normal browsing, not just heavy traffic. Entries are small
# (a few KB) except /page's "list" rows, whose worst-case size is now capped
# by PageLimitParam (see admissions.py/candidates.py) instead of the general
# 1000-row LimitParam, so raising maxsize doesn't risk the memory blowout a
# smaller cap on entry count was never actually protecting against.
_TTL_SECONDS = 24 * 60 * 60
_cache = TTLCache(maxsize=50_000, ttl=_TTL_SECONDS)
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
