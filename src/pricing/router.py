import os
import stripe
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from typing import Any, Literal, Union
from supabase import create_client, Client
from dotenv import load_dotenv
load_dotenv()

class PaymentResponse(BaseModel):
  status: Literal["success", "error"]
  data: Any | None = None
  message: str | None = None


stripe.api_key = os.environ.get("STRIPE_API_KEY")
YOUR_DOMAIN = "http://localhost:5173"

router = APIRouter(
  prefix="/v1/pricing",
  tags=["results"],
  responses={404: {"description": "Not found"}}
)
@router.post("/checkout")
def create_checkout_session():
  try:
    checkout_session = stripe.checkout.Session.create(
      line_items=[
        {
          'price': 'price_1QSiKfJk2hOzAB3P5JjcjwOL',
          'quantity': 1,
        },
      ],
      mode='subscription',
      success_url= YOUR_DOMAIN + '/dashboard' + '?success=true',
      cancel_url=YOUR_DOMAIN + '/dashboard' + '?canceled=true',
      automatic_tax={'enabled': True},
    )

    return PaymentResponse(
      status="success",
      message=checkout_session.url
    )

  except Exception as e:
    return PaymentResponse(
      status="error",
      message=str(e)
    )