from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class BeneficiaryBase(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=160, examples=["Lumen Designs"])
    agreed_amount: float = Field(..., ge=0, description="Agreed amount per period (USD)", examples=[800.0])
    period_limit: float = Field(..., ge=0, description="Maximum amount to pay in the period (USD)", examples=[800.0])
    active: bool = True

    @field_validator("display_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("display_name cannot be empty")
        return v

    @model_validator(mode="after")
    def check_limit_covers_agreed(self):
        if self.period_limit < self.agreed_amount:
            raise ValueError("period_limit cannot be lower than agreed_amount")
        return self

class BeneficiaryCreate(BeneficiaryBase):
    pass

class BeneficiaryUpdate(BeneficiaryBase):
    pass

class BeneficiaryResponse(BeneficiaryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)