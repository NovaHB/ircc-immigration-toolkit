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


def query_mart(
    table: str,
    province: str | None,
    year: int | None,
    month: int | None,
    limit: int,
    offset: int,
) -> list[dict]:
    client = get_client()
    # limit/offset are plain Python ints already validated (ge/le) by FastAPI's
    # Query(...) before this function is ever called, so embedding them
    # directly is safe — BigQuery's LIMIT/OFFSET clauses don't accept bind
    # parameters, only integer literals. province/year/month are still passed
    # as real query parameters since those are unconstrained user-supplied values.
    query = f"""
        SELECT *
        FROM `{BQ_PROJECT}.{BQ_DATASET}.{table}`
        WHERE (@province IS NULL OR province_territory = @province)
          AND (@year IS NULL OR year = @year)
          AND (@month IS NULL OR month = @month)
        ORDER BY {ORDER_BY_COLUMNS[table]}
        LIMIT {limit}
        OFFSET {offset}
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("province", "STRING", province),
            bigquery.ScalarQueryParameter("year", "INT64", year),
            bigquery.ScalarQueryParameter("month", "INT64", month),
        ]
    )
    rows = client.query(query, job_config=job_config).result()
    return [dict(row) for row in rows]


LimitParam = Query(100, ge=1, le=1000)
OffsetParam = Query(0, ge=0)


@router.get("/category")
def get_admissions_category(
    province: str | None = None,
    year: int | None = None,
    month: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart("mart_admissions_immcat", province, year, month, limit, offset)


@router.get("/gender")
def get_admissions_gender(
    province: str | None = None,
    year: int | None = None,
    month: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart("mart_admissions_gender", province, year, month, limit, offset)


@router.get("/citizenship")
def get_admissions_citizenship(
    province: str | None = None,
    year: int | None = None,
    month: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart("mart_admissions_citz", province, year, month, limit, offset)


@router.get("/birth-country")
def get_admissions_birth_country(
    province: str | None = None,
    year: int | None = None,
    month: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart("mart_admissions_cob", province, year, month, limit, offset)


@router.get("/age-group")
def get_admissions_age_group(
    province: str | None = None,
    year: int | None = None,
    month: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart("mart_admissions_agegroup", province, year, month, limit, offset)


@router.get("/occupation")
def get_admissions_occupation(
    province: str | None = None,
    year: int | None = None,
    month: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart("mart_admissions_occ", province, year, month, limit, offset)


@router.get("/census-subdivision")
def get_admissions_census_subdivision(
    province: str | None = None,
    year: int | None = None,
    month: int | None = None,
    limit: int = LimitParam,
    offset: int = OffsetParam,
):
    return query_mart("mart_admissions_csd", province, year, month, limit, offset)
