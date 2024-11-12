from pydantic import BaseModel
from typing import Any, Literal, Optional

class UserResponse(BaseModel):
  status: Literal["success", "error"]
  data: Any | None = None
  message: str | None = None

class UserModel(BaseModel):
  name: Optional[str] = None
  email: str
  password: str

class Token(BaseModel):
  access_token: str
  token_type: str
