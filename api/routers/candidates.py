import json
import os

from fastapi import APIRouter, Query
from google.cloud import bigquery
from google.oauth2 import service_account

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
    rows = client.query(query, job_config=job_config).result()
    return [dict(row) for row in rows]


def query_top_values(
    table: str,
    province: str | None,
    year: int | None,
    invitation_category: str | None,
    limit: int,
) -> list[dict]:
    """True top-N dimension values by SUM(candidates_count) over the full mart.

    Returns [{ name, total }] ordered by total DESC — not a partial first page.
    """
    client = get_client()
    dim_col = DIMENSION_VALUE_COLUMNS[table]
    query = f"""
        SELECT
          {dim_col} AS name,
          SUM(candidates_count) AS total
        FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
        {_where_clause()}
        GROUP BY name
        ORDER BY total DESC, name
        LIMIT {limit}
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=_filter_params(province, year, invitation_category)
    )
    rows = client.query(query, job_config=job_config).result()
    return [{"name": row["name"] or "—", "total": int(row["total"] or 0)} for row in rows]


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
    rows = list(client.query(query, job_config=job_config).result())
    shares = []
    for row in rows:
        total = float(row["total"] or 0)
        top_total = float(row["top_total"] or 0)
        shares.append((top_total / total * 100.0) if total > 0 else 0.0)
    national_avg = sum(shares) / len(shares) if shares else 0.0
    return [
        {
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
    invitation_category: str | None,
) -> dict:
    """Distinct dimension values + total candidates for the current filters."""
    client = get_client()
    dim_col = DIMENSION_VALUE_COLUMNS[table]
    query = f"""
        SELECT
          COUNT(DISTINCT {dim_col}) AS distinct_values,
          COALESCE(SUM(candidates_count), 0) AS total_candidates,
          COUNT(*) AS row_count
        FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
        {_where_clause()}
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=_filter_params(province, year, invitation_category)
    )
    row = list(client.query(query, job_config=job_config).result())[0]
    return {
        "distinct_values": int(row["distinct_values"] or 0),
        "total_candidates": int(row["total_candidates"] or 0),
        "row_count": int(row["row_count"] or 0),
    }


LimitParam = Query(100, ge=1, le=1000)
OffsetParam = Query(0, ge=0)
TopLimitParam = Query(10, ge=1, le=50)
SortParam = Query("key", pattern="^(key|candidates)$")


# --- invitation-category: invitation_category IS the dimension here, so it
# is never accepted as an additional cross-filter (matches the pre-existing
# list-endpoint contract below). ---


@router.get("/invitation-category/top")
def get_top_invitation_category(
    province: str | None = None,
    year: int | None = None,
    limit: int = TopLimitParam,
):
    return query_top_values("mart_candidates_intdest", province, year, None, limit)


@router.get("/invitation-category/trend")
def get_trend_invitation_category(
    province: str | None = None,
    year: int | None = None,
):
    return query_yearly_trend("mart_candidates_intdest", province, year, None)


@router.get("/invitation-category/summary")
def get_summary_invitation_category(
    province: str | None = None,
    year: int | None = None,
):
    return query_summary("mart_candidates_intdest", province, year, None)


@router.get("/invitation-category")
def get_candidates_invitation_category(
    province: str | None = None,
    year: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
    sort: str = SortParam,
):
    # invitation_category is this mart's dimension — not an additional filter.
    return query_mart(
        "mart_candidates_intdest", province, year, None, limit, offset, sort=sort
    )


@router.get("/ita-score/top")
def get_top_ita_score(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = TopLimitParam,
):
    return query_top_values(
        "mart_candidates_itascore", province, year, invitation_category, limit
    )


@router.get("/ita-score/trend")
def get_trend_ita_score(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_yearly_trend(
        "mart_candidates_itascore", province, year, invitation_category
    )


@router.get("/ita-score/summary")
def get_summary_ita_score(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_summary(
        "mart_candidates_itascore", province, year, invitation_category
    )


@router.get("/ita-score")
def get_candidates_ita_score(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
    sort: str = SortParam,
):
    return query_mart(
        "mart_candidates_itascore",
        province,
        year,
        invitation_category,
        limit,
        offset,
        sort=sort,
    )


@router.get("/citizenship/top")
def get_top_citizenship(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = TopLimitParam,
):
    return query_top_values(
        "mart_candidates_citz", province, year, invitation_category, limit
    )


@router.get("/citizenship/trend")
def get_trend_citizenship(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_yearly_trend(
        "mart_candidates_citz", province, year, invitation_category
    )


@router.get("/citizenship/summary")
def get_summary_citizenship(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_summary(
        "mart_candidates_citz", province, year, invitation_category
    )


@router.get("/citizenship")
def get_candidates_citizenship(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
    sort: str = SortParam,
):
    return query_mart(
        "mart_candidates_citz",
        province,
        year,
        invitation_category,
        limit,
        offset,
        sort=sort,
    )


@router.get("/field-of-study/top")
def get_top_field_of_study(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = TopLimitParam,
):
    return query_top_values(
        "mart_candidates_fieldofstudy", province, year, invitation_category, limit
    )


@router.get("/field-of-study/trend")
def get_trend_field_of_study(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_yearly_trend(
        "mart_candidates_fieldofstudy", province, year, invitation_category
    )


@router.get("/field-of-study/summary")
def get_summary_field_of_study(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_summary(
        "mart_candidates_fieldofstudy", province, year, invitation_category
    )


@router.get("/field-of-study")
def get_candidates_field_of_study(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
    sort: str = SortParam,
):
    return query_mart(
        "mart_candidates_fieldofstudy",
        province,
        year,
        invitation_category,
        limit,
        offset,
        sort=sort,
    )


@router.get("/first-language/top")
def get_top_first_language(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = TopLimitParam,
):
    return query_top_values(
        "mart_candidates_firstofflang", province, year, invitation_category, limit
    )


@router.get("/first-language/trend")
def get_trend_first_language(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_yearly_trend(
        "mart_candidates_firstofflang", province, year, invitation_category
    )


@router.get("/first-language/summary")
def get_summary_first_language(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_summary(
        "mart_candidates_firstofflang", province, year, invitation_category
    )


@router.get("/first-language")
def get_candidates_first_language(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
    sort: str = SortParam,
):
    return query_mart(
        "mart_candidates_firstofflang",
        province,
        year,
        invitation_category,
        limit,
        offset,
        sort=sort,
    )


@router.get("/occupation/top")
def get_top_occupation(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = TopLimitParam,
):
    return query_top_values(
        "mart_candidates_occupation", province, year, invitation_category, limit
    )


@router.get("/occupation/trend")
def get_trend_occupation(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_yearly_trend(
        "mart_candidates_occupation", province, year, invitation_category
    )


@router.get("/occupation/summary")
def get_summary_occupation(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
):
    return query_summary(
        "mart_candidates_occupation", province, year, invitation_category
    )


@router.get("/occupation")
def get_candidates_occupation(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
    sort: str = SortParam,
):
    return query_mart(
        "mart_candidates_occupation",
        province,
        year,
        invitation_category,
        limit,
        offset,
        sort=sort,
    )
