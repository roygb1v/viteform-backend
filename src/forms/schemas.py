from typing import Any, List, Dict, Optional, Literal
from pydantic import BaseModel

class FormResponse(BaseModel):
  status: Literal["success", "error"]
  data: Any | None = None
  message: str | None = None

class ThemeSchema(BaseModel):
    bgColor: str
    btnColor: str
    qsColor: str
    ansColor: str

class OptionSchema(BaseModel):
    value: str
    label: str

class Required(BaseModel):
    value: bool
    message: str

class MinLength(BaseModel):
    value: int
    message: str

class MaxLength(BaseModel):
    value: int
    message: str

class Pattern(BaseModel):
    value: str
    message: str = "Please enter a valid email address"

class Min(BaseModel):
    value: int
    message: str = "Minimum value must be at least "

class Max(BaseModel):
    value: int
    message: str = "Maximum value cannot exceed "

class RuleSchema(BaseModel):
    required: Required
    minLength: Optional[MinLength | None] = None
    maxLength: Optional[MaxLength | None] = None
    min: Optional[Min | None] = None
    max: Optional[Max | None] = None
    pattern: Optional[Pattern | None] = None

class QuestionSchema(BaseModel):
    id: str
    name: str
    type: str
    title: str
    description: str
    options: List[OptionSchema]
    answer: Optional[List[OptionSchema]] = None
    rules: RuleSchema

class StepSchema(BaseModel):
    id: str
    questions: List[QuestionSchema]

class FormConfigSchema(BaseModel):
    id: str
    title: str
    description: str
    plan: str
    theme: ThemeSchema
    steps: List[StepSchema]
    user_id: str

  
class QuestionResponseSchema(BaseModel):
    question_id: str
    question_type: str
    label: Optional[str] = None
    value: str

class FormSubmissionSchema(BaseModel):
    form_id: str
    status: str
    data: List[QuestionResponseSchema]