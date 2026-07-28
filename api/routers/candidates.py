import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Query
from google.cloud import bigquery
from google.oauth2 import service_account

from .cache import cache_get, cache_set, make_key
from .timing import log_cache_hit, log_timing, run_timed_query, time_json_dumps

router = APIRouter(prefix="/candidates", tags=["candidates"])

BQ_PROJECT = "ircc-502916"
BQ_DATASET = "ircc_pipeline"

_client = None

# Matches each mart's dbt snapshot unique_key tuple exactly, so this ordering
# is provably unique per row — required for stable LIMIT/OFFSET pagination.
# Candidates grain is annual (plus a partial string month for 2026); month is
# not part of the unique key and is not a filterable calendar month.
ORDER_BY_COLUMNS = {
    "mart_candidates_intdest": "province_territory, invitation_category, year",
    "mart_candidates_itascore": "province_territory, ita_score, invitation_category, year",
    "mart_candidates_citz": "province_territory, country_of_citizenship, invitation_category, year",
    "mart_candidates_fieldofstudy": "province_territory, field_of_study, invitation_category, year",
    "mart_candidates_firstofflang": "province_territory, first_official_language, invitation_category, year",
    "mart_candidates_occupation": "province_territory, occupation_noc2011, invitation_category, year",
}

# Primary dimension column used for "top values" aggregation (GROUP BY).
DIMENSION_VALUE_COLUMNS = {
    "mart_candidates_intdest": "invitation_category",
    "mart_candidates_itascore": "ita_score",
    "mart_candidates_citz": "country_of_citizenship",
    "mart_candidates_fieldofstudy": "field_of_study",
    "mart_candidates_firstofflang": "first_official_language",
    "mart_candidates_occupation": "occupation_noc2011",
}


def get_client() -> bigquery.Client:
    """Lazily builds the BigQuery client (same dual-auth as admissions).

    Auth priority:
      1. GOOGLE_CREDENTIALS_JSON — full service-account JSON as a string
      2. GOOGLE_APPLICATION_CREDENTIALS — path to a key file (local dev)
    """
    global _client
    if _client is None:
        credentials_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
        if credentials_json:
            info = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(info)
        else:
            keyfile = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
            credentials = service_account.Credentials.from_service_account_file(keyfile)
        _client = bigquery.Client(credentials=credentials, project=BQ_PROJECT)
    return _client


def _filter_params(province: str | None, year: int | None, invitation_category: str | None):
    return [
        bigquery.ScalarQueryParameter("province", "STRING", province),
        bigquery.ScalarQueryParameter("year", "INT64", year),
        bigquery.ScalarQueryParameter("invitation_category", "STRING", invitation_category),
    ]


def _where_clause() -> str:
    return """
        WHERE (@province IS NULL OR province_territory = @province)
          AND (@year IS NULL OR year = @year)
          AND (@invitation_category IS NULL OR invitation_category = @invitation_category)
    """


def query_mart(
    table: str,
    province: str | None,
    year: int | None,
    invitation_category: str | None,
    limit: int,
    offset: int,
    sort: str = "key",
) -> list[dict]:
    """Row-level page from a candidates mart.

    sort:
      - "key" (default): full dimension key ORDER BY — deterministic pagination
      - "candidates" : highest candidates_count first (tie-broken by key)

    Filters province / year / invitation_category are bound parameters.
    limit / offset are validated ints embedded as LIMIT/OFFSET literals
    (BigQuery does not accept bind params for those clauses).
    """
    t_start = time.perf_counter()
    filters = {
        "province": province,
        "year": year,
        "invitation_category": invitation_category,
        "limit": limit,
        "offset": offset,
        "sort": sort,
    }
    cache_key = make_key("list", table, **filters)
    cached = cache_get(cache_key)
    if cached is not None:
        log_cache_hit("list", table, filters, round((time.perf_counter() - t_start) * 1000, 1))
        return cached

    client = get_client()
    if sort == "candidates":
        order_by = f"candidates_count DESC, {ORDER_BY_COLUMNS[table]}"
    else:
        order_by = ORDER_BY_COLUMNS[table]
    query = f"""
        SELECT *
        FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
        {_where_clause()}
        ORDER BY {order_by}
        LIMIT {limit}
        OFFSET {offset}
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=_filter_params(province, year, invitation_category)
    )
    rows, timings = run_timed_query(client, query, job_config)
    result = [dict(row) for row in rows]

    serialize_ms = time_json_dumps(result)
    total_ms = round((time.perf_counter() - t_start) * 1000, 1)
    log_timing("list", table, filters, timings, serialize_ms, total_ms)
    cache_set(cache_key, result)
    return result


def query_top_and_summary(
    table: str,
    province: str | None,
    year: int | None,
    invitation_category: str | None,
    top_limit: int,
) -> tuple[list[dict], dict]:
    """Top-N dimension values AND the distinct/total/row-count summary in one
    BigQuery pass — merges what used to be two separate queries (query_top_values
    + query_summary) since the summary aggregates are computed over every group
    regardless of the ARRAY_AGG's own LIMIT, so both can come from a single
    GROUP BY. Returns (top_list, summary_dict).
    """
    t_start = time.perf_counter()
    filters = {"province": province, "year": year, "invitation_category": invitation_category, "top_limit": top_limit}
    cache_key = make_key("top_summary", table, **filters)
    cached = cache_get(cache_key)
    if cached is not None:
        log_cache_hit("top_summary", table, filters, round((time.perf_counter() - t_start) * 1000, 1))
        return cached

    client = get_client()
    dim_col = DIMENSION_VALUE_COLUMNS[table]
    query = f"""
        WITH filtered AS (
          SELECT {dim_col} AS dim_value, candidates_count
          FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
          {_where_clause()}
        ),
        grouped AS (
          SELECT dim_value AS name, SUM(candidates_count) AS total, COUNT(*) AS cnt
          FROM filtered
          GROUP BY name
        )
        SELECT
          ARRAY_AGG(STRUCT(name, total) ORDER BY total DESC, name LIMIT {top_limit}) AS top_rows,
          COUNT(*) AS distinct_values,
          COALESCE(SUM(total), 0) AS total_candidates,
          COALESCE(SUM(cnt), 0) AS row_count
        FROM grouped
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=_filter_params(province, year, invitation_category)
    )
    rows, timings = run_timed_query(client, query, job_config)
    row = rows[0]
    top = [{"name": r["name"] or "—", "total": int(r["total"] or 0)} for r in (row["top_rows"] or [])]
    summary = {
        "distinct_values": int(row["distinct_values"] or 0),
        "total_candidates": int(row["total_candidates"] or 0),
        "row_count": int(row["row_count"] or 0),
    }
    result = (top, summary)

    serialize_ms = time_json_dumps(result)
    total_ms = round((time.perf_counter() - t_start) * 1000, 1)
    log_timing("top_summary", table, filters, timings, serialize_ms, total_ms)
    cache_set(cache_key, result)
    return result


def query_yearly_trend(
    table: str,
    province: str | None,
    year: int | None,
    invitation_category: str | None,
) -> list[dict]:
    """Per-year share of the overall top dimension value.

    Candidates grain is annual, so this is the yearly analogue of admissions'
    monthly /trend — one point per year present in the filtered data (no
    12-point window truncation since there are far fewer years than months).
    """
    t_start = time.perf_counter()
    filters = {"province": province, "year": year, "invitation_category": invitation_category}
    cache_key = make_key("trend", table, **filters)
    cached = cache_get(cache_key)
    if cached is not None:
        log_cache_hit("trend", table, filters, round((time.perf_counter() - t_start) * 1000, 1))
        return cached

    client = get_client()
    dim_col = DIMENSION_VALUE_COLUMNS[table]
    query = f"""
        WITH filtered AS (
          SELECT year, {dim_col} AS dim_value, candidates_count
          FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
          {_where_clause()}
        ),
        top_dim AS (
          SELECT dim_value
          FROM filtered
          GROUP BY dim_value
          ORDER BY SUM(candidates_count) DESC
          LIMIT 1
        ),
        yearly AS (
          SELECT
            year,
            SUM(candidates_count) AS total,
            SUM(IF(dim_value = (SELECT dim_value FROM top_dim), candidates_count, 0)) AS top_total
          FROM filtered
          GROUP BY year
        )
        SELECT year, total, top_total
        FROM yearly
        ORDER BY year
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=_filter_params(province, year, invitation_category)
    )
    rows, timings = run_timed_query(client, query, job_config)
    shares = []
    for row in rows:
        total = float(row["total"] or 0)
        top_total = float(row["top_total"] or 0)
        shares.append((top_total / total * 100.0) if total > 0 else 0.0)
    national_avg = sum(shares) / len(shares) if shares else 0.0
    result = [
        {
            "year": int(row["year"]),
            "share": round(shares[i], 1),
            "nationalAvg": round(national_avg, 1),
        }
        for i, row in enumerate(rows)
    ]

    serialize_ms = time_json_dumps(result)
    total_ms = round((time.perf_counter() - t_start) * 1000, 1)
    log_timing("trend", table, filters, timings, serialize_ms, total_ms)
    cache_set(cache_key, result)
    return result


LimitParam = Query(100, ge=1, le=1000)
OffsetParam = Query(0, ge=0)
TopLimitParam = Query(10, ge=1, le=50)
SortParam = Query("key", pattern="^(key|candidates)$")
# Separate instance from TopLimitParam: FastAPI/Pydantic binds internal
# metadata (field name/alias) to a Query() object the first time it's used,
# so reusing the same instance as a default for a *differently-named*
# parameter (here "top_limit" vs. "limit" on /top) causes it to silently
# resolve to the other parameter's value. Each distinct parameter name needs
# its own Query() instance even if the validation rules are identical.
PageTopLimitParam = Query(8, ge=1, le=50)
# /page's own "limit" ceiling, deliberately separate from the general-purpose
# LimitParam above (le=1000). InvitationsPage.jsx always requests limit=50 for
# /page and candidates.js has no full-table pager (unlike admissions'
# fetchAdmissionsPages), so nothing here needs more than 50. Capping /page's
# entry size keeps its cached responses small regardless.
PageLimitParam = Query(50, ge=1, le=100)

# Table registry for the shared top/summary/trend/list/page helpers.
MARTS = {
    "invitation-category": "mart_candidates_intdest",
    "ita-score": "mart_candidates_itascore",
    "citizenship": "mart_candidates_citz",
    "field-of-study": "mart_candidates_fieldofstudy",
    "first-language": "mart_candidates_firstofflang",
    "occupation": "mart_candidates_occupation",
}

# invitation_category is the dimension itself on this one slug, not an
# additional cross-filter — matches the pre-existing endpoint contract.
NO_INVITATION_FILTER = {"invitation-category"}


def _register_dimension_routes(slug: str, table: str) -> None:
    """Register row list + top + trend + summary + page for one dimension
    slug. Default-arg binding (_table=table, _accepts_filter=...) freezes
    each mart name/flag so the loop doesn't leave every route pointing at
    the last one.
    """
    accepts_invitation_filter = slug not in NO_INVITATION_FILTER

    @router.get(f"/{slug}/top", name=f"top_{slug}")
    def get_top(
        province: str | None = None,
        year: int | None = None,
        invitation_category: str | None = None,
        limit: int = TopLimitParam,
        _table: str = table,
        _accepts: bool = accepts_invitation_filter,
    ):
        top, _summary = query_top_and_summary(
            _table, province, year, invitation_category if _accepts else None, limit
        )
        return top

    @router.get(f"/{slug}/trend", name=f"trend_{slug}")
    def get_trend(
        province: str | None = None,
        year: int | None = None,
        invitation_category: str | None = None,
        _table: str = table,
        _accepts: bool = accepts_invitation_filter,
    ):
        return query_yearly_trend(
            _table, province, year, invitation_category if _accepts else None
        )

    @router.get(f"/{slug}/summary", name=f"summary_{slug}")
    def get_summary(
        province: str | None = None,
        year: int | None = None,
        invitation_category: str | None = None,
        _table: str = table,
        _accepts: bool = accepts_invitation_filter,
    ):
        # top_limit=1: the summary aggregates are computed over every group
        # regardless of the ARRAY_AGG's own LIMIT, so this doesn't need a
        # real top-N array, just the smallest one.
        _top, summary = query_top_and_summary(
            _table, province, year, invitation_category if _accepts else None, 1
        )
        return summary

    @router.get(f"/{slug}/page", name=f"page_{slug}")
    def get_page(
        province: str | None = None,
        year: int | None = None,
        invitation_category: str | None = None,
        limit: int = PageLimitParam,
        offset: int = OffsetParam,
        sort: str = SortParam,
        top_limit: int = PageTopLimitParam,
        _table: str = table,
        _accepts: bool = accepts_invitation_filter,
    ):
        """Combined page load: top + summary (1 query) + trend (1 query) +
        row list (1 query) = 3 BigQuery queries instead of 4 separate ones.
        Run concurrently via a small thread pool — each is a blocking
        network call, so this is the same effect the frontend's old
        Promise.all had across 4 separate requests, just collapsed into 1
        HTTP round trip. Without this, chaining the 3 queries sequentially
        would make a cache-miss page load *slower* than the old
        4-parallel-request pattern, not faster.
        """
        ic = invitation_category if _accepts else None
        with ThreadPoolExecutor(max_workers=3) as pool:
            top_summary_future = pool.submit(query_top_and_summary, _table, province, year, ic, top_limit)
            trend_future = pool.submit(query_yearly_trend, _table, province, year, ic)
            rows_future = pool.submit(query_mart, _table, province, year, ic, limit, offset, sort=sort)
            top, summary = top_summary_future.result()
            trend = trend_future.result()
            rows = rows_future.result()
        return {"top": top, "trend": trend, "summary": summary, "rows": rows}

    @router.get(f"/{slug}", name=f"list_{slug}")
    def get_list(
        province: str | None = None,
        year: int | None = None,
        invitation_category: str | None = None,
        limit: int = LimitParam,
        offset: int = OffsetParam,
        sort: str = SortParam,
        _table: str = table,
        _accepts: bool = accepts_invitation_filter,
    ):
        return query_mart(
            _table,
            province,
            year,
            invitation_category if _accepts else None,
            limit,
            offset,
            sort=sort,
        )


# Register more-specific /{slug}/top|trend|summary|page paths before bare
# /{slug} by defining them first inside _register_dimension_routes.
for _slug, _table in MARTS.items():
    _register_dimension_routes(_slug, _table)
