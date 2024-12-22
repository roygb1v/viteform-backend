from fastapi import HTTPException, status, Request
import jwt
from typing import Dict


def decode_jwt(token: str) -> Dict:
    """
    Decode a Supabase JWT token
    """
    try:
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        return decoded_token
        
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )

def get_jwt_user(request: Request):
  auth_header = request.headers.get('authorization', '')
  jwt = auth_header.replace('Bearer ', '')
  payload = decode_jwt(jwt)
  return payload.get('sub', '')