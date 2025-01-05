import os
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import create_client, Client
from .schemas import FormConfigSchema, FormSubmissionSchema, FormResponse
from src.utils import decode_jwt, get_jwt_user
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(
  prefix="/v1/forms",
  tags=["forms"],
  responses={404: {"description": "Not found"}}
)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# READ ALL FORMS [TODO]: Localised to user
@router.get("/",
  response_model=FormResponse,
  responses={
    404: {"description": "Form not found"},
    400: {"description": "Invalid form data"}
  }
)
def get_form(request: Request, page_size: int = 10, page_number: int = 0) -> FormResponse:
  try:
    user_id = get_jwt_user(request)
    response = supabase.table("form_configs") \
    .select("*") \
    .eq("user_id", user_id) \
    .range(page_number, page_number + page_size) \
    .execute()

    if not response.data:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Form with id {form_id} not found"
      )
    
    return FormResponse(
      status="success",
      data=response.data,
      message="Successfully retrieved form"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )

# CREATE FORM
@router.post("/", 
  response_model=FormResponse,
  responses={
    404: {"description": "Form not found"},
    400: {"description": "Invalid form data"}
  }
)
def create_form(form_config: FormConfigSchema) -> FormResponse:
  try:
    response = supabase.table("form_configs").insert(form_config.model_dump()).execute()

    return FormResponse(
      status="success",
      message="Form created successfully"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )

# READ FORM
@router.get("/",
  response_model=FormResponse,
  responses={
    404: {"description": "Form not found"},
    400: {"description": "Invalid form data"}
  }
)
def get_form(id: str) -> FormResponse:
  try:
    response = supabase.table("form_configs").select("*").eq("id", id).limit(1).execute()
    if not response.data:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Form with id {form_config.id} not found"
      )
    
    return FormResponse(
      status="success",
      data=response.data,
      message="Successfully retrieved form"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )

# UPDATE FORM
@router.put("/",
  response_model=FormResponse,
  responses={
    404: {"description": "Form not found"},
    400: {"description": "Invalid form data"}
  }
)
def update_form(form_config: FormConfigSchema) -> FormResponse:
  try:
    response = supabase.table("form_configs") \
      .update(form_config.model_dump()) \
      .eq("id", form_config.id) \
      .execute()

    if not response.data:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Form with id {form_config.id} not found"
      )
    return FormResponse(
      status="success",
      message="Form updated successfully"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )

# DELETE FORM
@router.delete("/",
  response_model=FormResponse,
  responses={
    404: {"description": "Form not found"},
    400: {"description": "Invalid form data"}
  }
)
def delete_form(id: str):
  try:
    response = supabase.table("form_configs").delete().eq("id", id).execute()

    return FormResponse(
      status="success",
      message="Form delete successfully"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )

# SUBMIT FORM
@router.post("/submit",
  response_model=FormResponse,
  responses={
    500: {"description": "Unable to submit form"}
  })
def submit_form(form: FormSubmissionSchema) -> FormResponse:
  try:
    f = {"form_id": form.form_id, "status": form.status}
    response = supabase.table("form_submissions").insert(f).execute().data[0]
    submission_id = response.get('id', '')
    
    question_responses = [{**datum.model_dump(), 'submission_id': submission_id} for datum in form.data]
    error = supabase.table("question_responses").insert(question_responses).execute()

    return FormResponse(
      status="success",
      message="Form submitted successfully"
    )
  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
      detail=str(e)
    )