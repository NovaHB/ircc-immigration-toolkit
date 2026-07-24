import json
import os

from fastapi import APIRouter, Query
from google.cloud import bigquery
from google.oauth2 import service_account

router = APIRouter(prefix="/admissions", tags=["admissions"])

BQ_PROJECT = "ircc-502916"
BQ_DATASET = "ircc_pipeline"

_client = None

# Matches each mart's dbt snapshot unique_key tuple exactly, so this ordering
# is provably unique per row — required for stable LIMIT/OFFSET pagination.
# Without the dimension column(s), ties on (province, year, month) alone (e.g.
# ~200 countries sharing one tuple) let BigQuery return them in a different,
# undefined order between queries, causing pages to skip/duplicate rows.
ORDER_BY_COLUMNS = {
    "mart_admissions_immcat": "province_territory, immigration_category, year, month",
    "mart_admissions_gender": "province_territory, gender, year, month",
    "mart_admissions_citz": "province_territory, country_of_citizenship, year, month",
    "mart_admissions_cob": "province_territory, country_of_birth, year, month",
    "mart_admissions_agegroup": "province_territory, age_group, year, month",
    "mart_admissions_occ": "province_territory, occupation_noc2011, year, month",
    "mart_admissions_csd": "province_territory, census_division, census_subdivision, year, month",
}

# Primary dimension column used for "top values" aggregation (GROUP BY).
DIMENSION_VALUE_COLUMNS = {
    "mart_admissions_immcat": "immigration_category",
    "mart_admissions_gender": "gender",
    "mart_admissions_citz": "country_of_citizenship",
    "mart_admissions_cob": "country_of_birth",
    "mart_admissions_agegroup": "age_group",
    "mart_admissions_occ": "occupation_noc2011",
    "mart_admissions_csd": "census_subdivision",
}


def get_client() -> bigquery.Client:
    """Lazily builds the BigQuery client so the app can still start (and
    serve /docs) even if credentials aren't configured yet.

    Auth priority:
      1. GOOGLE_CREDENTIALS_JSON — full service-account JSON as a string
         (Render / other hosts that cannot mount a key file)
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


def _filter_params(province: str | None, year: int | None, month: int | None):
    return [
        bigquery.ScalarQueryParameter("province", "STRING", province),
        bigquery.ScalarQueryParameter("year", "INT64", year),
        bigquery.ScalarQueryParameter("month", "INT64", month),
    ]


def _where_clause() -> str:
    return """
        WHERE (@province IS NULL OR province_territory = @province)
          AND (@year IS NULL OR year = @year)
          AND (@month IS NULL OR month = @month)
    """


def query_mart(
    table: str,
    province: str | None,
    year: int | None,
    month: int | None,
    limit: int,
    offset: int,
    sort: str = "key",
) -> list[dict]:
    """Row-level page from a mart.

    sort:
      - "key" (default): full dimension key ORDER BY — deterministic pagination
      - "admissions": highest admissions first (still tie-broken by key for stability)
    """
    client = get_client()
    if sort == "admissions":
        order_by = f"admissions_count DESC, {ORDER_BY_COLUMNS[table]}"
    else:
        order_by = ORDER_BY_COLUMNS[table]

    # limit/offset are plain Python ints already validated (ge/le) by FastAPI's
    # Query(...) before this function is ever called, so embedding them
    # directly is safe — BigQuery's LIMIT/OFFSET clauses don't accept bind
    # parameters, only integer literals. province/year/month are still passed
    # as real query parameters since those are unconstrained user-supplied values.
    query = f"""
        SELECT *
        FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
        {_where_clause()}
        ORDER BY {order_by}
        LIMIT {limit}
        OFFSET {offset}
    """
    job_config = bigquery.QueryJobConfig(query_parameters=_filter_params(province, year, month))
    rows = client.query(query, job_config=job_config).result()
    return [dict(row) for row in rows]


def query_top_values(
    table: str,
    province: str | None,
    year: int | None,
    month: int | None,
    limit: int,
) -> list[dict]:
    """True top-N dimension values by SUM(admissions_count) over the full mart.

    Returns [{ name, total }] ordered by total DESC — not a partial first page.
    """
    client = get_client()
    dim_col = DIMENSION_VALUE_COLUMNS[table]
    # dim_col / limit are from a fixed allow-list / validated int — safe to embed.
    query = f"""
        SELECT
          {dim_col} AS name,
          SUM(admissions_count) AS total
        FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
        {_where_clause()}
        GROUP BY name
        ORDER BY total DESC, name
        LIMIT {limit}
    """
    job_config = bigquery.QueryJobConfig(query_parameters=_filter_params(province, year, month))
    rows = client.query(query, job_config=job_config).result()
    return [{"name": row["name"] or "—", "total": int(row["total"] or 0)} for row in rows]


def query_share_trend(
    table: str,
    province: str | None,
    year: int | None,
    month: int | None,
) -> list[dict]:
    """Last 12 year-month buckets: share of the overall top dimension value.

    National avg here is the mean of that top-value's monthly share across the window.
    """
    client = get_client()
    dim_col = DIMENSION_VALUE_COLUMNS[table]
    query = f"""
        WITH filtered AS (
          SELECT year, month, {dim_col} AS dim_value, admissions_count
          FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
          {_where_clause()}
        ),
        top_dim AS (
          SELECT dim_value
          FROM filtered
          GROUP BY dim_value
          ORDER BY SUM(admissions_count) DESC
          LIMIT 1
        ),
        monthly AS (
          SELECT
            year,
            month,
            SUM(admissions_count) AS total,
            SUM(IF(dim_value = (SELECT dim_value FROM top_dim), admissions_count, 0)) AS top_total
          FROM filtered
          GROUP BY year, month
        )
        SELECT year, month, total, top_total
        FROM monthly
        ORDER BY year DESC, month DESC
        LIMIT 12
    """
    job_config = bigquery.QueryJobConfig(query_parameters=_filter_params(province, year, month))
    rows = list(client.query(query, job_config=job_config).result())
    # Chronological order for the chart
    rows = list(reversed(rows))
    month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    shares = []
    for row in rows:
        total = float(row["total"] or 0)
        top_total = float(row["top_total"] or 0)
        shares.append((top_total / total * 100.0) if total > 0 else 0.0)
    national_avg = sum(shares) / len(shares) if shares else 0.0
    return [
        {
            "month": month_names[(int(row["month"]) - 1) % 12],
            "year": int(row["year"]),
            "share": round(shares[i], 1),
            "nationalAvg": round(national_avg, 1),
        }
        for i, row in enumerate(rows)
    ]


def query_summary(
    table: str,
    province: str | None,
    year: int | None,
    month: int | None,
) -> dict:
    """Distinct dimension values + total admissions for the current filters."""
    client = get_client()
    dim_col = DIMENSION_VALUE_COLUMNS[table]
    query = f"""
        SELECT
          COUNT(DISTINCT {dim_col}) AS distinct_values,
          COALESCE(SUM(admissions_count), 0) AS total_admissions,
          COUNT(*) AS row_count
        FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
        {_where_clause()}
    """
    job_config = bigquery.QueryJobConfig(query_parameters=_filter_params(province, year, month))
    row = list(client.query(query, job_config=job_config).result())[0]
    return {
        "distinct_values": int(row["distinct_values"] or 0),
        "total_admissions": int(row["total_admissions"] or 0),
        "row_count": int(row["row_count"] or 0),
    }


LimitParam = Query(100, ge=1, le=1000)
OffsetParam = Query(0, ge=0)
TopLimitParam = Query(10, ge=1, le=50)
SortParam = Query("key", pattern="^(key|admissions)$")

# Table registry for the shared top/summary/trend helpers
MARTS = {
    "category": "mart_admissions_immcat",
    "gender": "mart_admissions_gender",
    "citizenship": "mart_admissions_citz",
    "birth-country": "mart_admissions_cob",
    "age-group": "mart_admissions_agegroup",
    "occupation": "mart_admissions_occ",
    "census-subdivision": "mart_admissions_csd",
}


def _register_dimension_routes(slug: str, table: str) -> None:
    """Register row list + top + trend + summary for one dimension slug.

    Default-arg binding (_table=table) freezes each mart name so the loop
    does not leave every route pointing at the last table.
    """

    @router.get(f"/{slug}/top", name=f"top_{slug}")
    def get_top(
        province: str | None = None,
        year: int | None = None,
        month: int | None = None,
        limit: int = TopLimitParam,
        _table: str = table,
    ):
        return query_top_values(_table, province, year, month, limit)

    @router.get(f"/{slug}/trend", name=f"trend_{slug}")
    def get_trend(
        province: str | None = None,
        year: int | None = None,
        month: int | None = None,
        _table: str = table,
    ):
        return query_share_trend(_table, province, year, month)

    @router.get(f"/{slug}/summary", name=f"summary_{slug}")
    def get_summary(
        province: str | None = None,
        year: int | None = None,
        month: int | None = None,
        _table: str = table,
    ):
        return query_summary(_table, province, year, month)

    @router.get(f"/{slug}", name=f"list_{slug}")
    def get_list(
        province: str | None = None,
        year: int | None = None,
        month: int | None = None,
        limit: int = LimitParam,
        offset: int = OffsetParam,
        sort: str = SortParam,
        _table: str = table,
    ):
        return query_mart(_table, province, year, month, limit, offset, sort=sort)


# Register more-specific /{slug}/top|trend|summary paths before bare /{slug}
# by defining them first inside _register_dimension_routes.
for _slug, _table in MARTS.items():
    _register_dimension_routes(_slug, _table)
