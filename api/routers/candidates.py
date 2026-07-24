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


def query_mart(
    table: str,
    province: str | None,
    year: int | None,
    invitation_category: str | None,
    limit: int,
    offset: int,
) -> list[dict]:
    """Row-level page from a candidates mart.

    Filters province / year / invitation_category are bound parameters.
    limit / offset are validated ints embedded as LIMIT/OFFSET literals
    (BigQuery does not accept bind params for those clauses).
    """
    client = get_client()
    order_by = ORDER_BY_COLUMNS[table]
    query = f"""
        SELECT *
        FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
        WHERE (@province IS NULL OR province_territory = @province)
          AND (@year IS NULL OR year = @year)
          AND (@invitation_category IS NULL OR invitation_category = @invitation_category)
        ORDER BY {order_by}
        LIMIT {limit}
        OFFSET {offset}
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("province", "STRING", province),
            bigquery.ScalarQueryParameter("year", "INT64", year),
            bigquery.ScalarQueryParameter(
                "invitation_category", "STRING", invitation_category
            ),
        ]
    )
    rows = client.query(query, job_config=job_config).result()
    return [dict(row) for row in rows]


LimitParam = Query(100, ge=1, le=1000)
OffsetParam = Query(0, ge=0)


@router.get("/invitation-category")
def get_candidates_invitation_category(
    province: str | None = None,
    year: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    # invitation_category is this mart's dimension — not an additional filter.
    return query_mart(
        "mart_candidates_intdest", province, year, None, limit, offset
    )


@router.get("/ita-score")
def get_candidates_ita_score(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart(
        "mart_candidates_itascore",
        province,
        year,
        invitation_category,
        limit,
        offset,
    )


@router.get("/citizenship")
def get_candidates_citizenship(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart(
        "mart_candidates_citz",
        province,
        year,
        invitation_category,
        limit,
        offset,
    )


@router.get("/field-of-study")
def get_candidates_field_of_study(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart(
        "mart_candidates_fieldofstudy",
        province,
        year,
        invitation_category,
        limit,
        offset,
    )


@router.get("/first-language")
def get_candidates_first_language(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart(
        "mart_candidates_firstofflang",
        province,
        year,
        invitation_category,
        limit,
        offset,
    )


@router.get("/occupation")
def get_candidates_occupation(
    province: str | None = None,
    year: int | None = None,
    invitation_category: str | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart(
        "mart_candidates_occupation",
        province,
        year,
        invitation_category,
        limit,
        offset,
    )
