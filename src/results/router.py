import os
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import create_client, Client
from .schemas import FormResultsResponse
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(
  prefix="/v1/results",
  tags=["results"],
  responses={404: {"description": "Not found"}}
)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

@router.get("/",
  response_model=FormResultsResponse,
  responses={
    404: {"description": "Form not found"},
    400: {"description": "Invalid form data"}
  }
)
def get_form_results(form_id: str) -> FormResultsResponse:
  try:
    response = supabase.rpc('results', {
      'form_id': form_id
    }).execute()

    if not response:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Form with id {form_config.id} not found"
      )
    
    return FormResultsResponse(
      status="success",
      data=response.data,
      message="Successfully retrieved form"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )

# QUERY TO GET FORM_RESPONSES
# SELECT
#   COUNT(*),
#   qr.question_id,
#   qr.question_type,
#   qr.value
# FROM
#   question_responses qr
#   INNER JOIN form_submissions ON form_submissions.id = qr.submission_id
#   INNER JOIN form_configs ON form_configs.id = form_submissions.form_id
# WHERE
#   form_configs.id = '4cf38574-2262-4ebe-8618-8ad22c5d6011'
# GROUP BY
#   qr.question_id,
#   qr.question_type,
#   qr.value


# QUERY TO GET FORM_QUESTIONS EXTRACTED FROM FORM_CONFIGS
# WITH response_counts AS (
#     SELECT
#         qr.question_id,
#         qr.value,
#         COUNT(*) as count
#     FROM
#         question_responses qr
#         INNER JOIN form_submissions ON form_submissions.id = qr.submission_id
#         INNER JOIN form_configs ON form_configs.id = form_submissions.form_id
#     WHERE
#         form_configs.id = '4cf38574-2262-4ebe-8618-8ad22c5d6011'
#     GROUP BY
#         qr.value,
#         qr.question_id
#     )
# SELECT jsonb_build_object(
#     'id', question->>'id',
#     'name', question->>'name',
#     'type', question->>'type',
#     'title', question->>'title',
#     'description', question->>'description',
#     'options', (
#         SELECT jsonb_agg(
#             jsonb_build_object(
#                 'label', opt->>'label',
#                 'count', COALESCE((
#                     SELECT count 
#                     FROM response_counts 
#                     WHERE question_id = question->>'id'
#                     AND value = opt->>'label'
#                 ), 0)
#             )
#         )
#         FROM jsonb_array_elements(question->'options') opt
#     )
# ) as question_data
# FROM form_configs,
#      jsonb_array_elements(steps) pages,
#      jsonb_array_elements(pages->'questions') question
# WHERE question->>'id' IN ('aaa', 'bbb', 'eee')
# AND form_configs.id = '4cf38574-2262-4ebe-8618-8ad22c5d6011';