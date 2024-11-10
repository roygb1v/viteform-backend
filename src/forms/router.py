import os
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import create_client, Client
from .schemas import FormConfigSchema, FormResponse
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


# READ ALL FORMS [TODO]: Localised to user
@router.get("/all",
  response_model=FormResponse,
  responses={
    404: {"description": "Form not found"},
    400: {"description": "Invalid form data"}
  }
)
def get_form(page_size: int = 10, page_number: int = 0) -> FormResponse:
  try:
    response = supabase.table("form_configs").select("*").range(page_number, page_number + page_size).execute() 
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
