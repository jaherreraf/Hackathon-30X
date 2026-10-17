from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class ExchangeRateBase(BaseModel):
    currency: str = Field(..., min_length=3, max_length=3, examples=["EUR"])
    rate_to_usd: float = Field(..., gt=0, examples=[1.08])

    @field_validator("currency")
    @classmethod
    def currency_uppercase(cls, v: str) -> str:
        return v.strip().upper()

class ExchangeRateCreate(ExchangeRateBase):
    pass

class ExchangeRateResponse(ExchangeRateBase):
    id: int | None = None

    model_config = ConfigDict(from_attributes=True)

class RuleBase(BaseModel):
    company_name: str = Field(..., min_length=1, examples=["Acme Corp"])
    period: str = Field(
        ...,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
        examples=["2026-10"],
        description="YYYY-MM format",
    )

    per_payment_limit: float = Field(..., gt=0, description="Maximum limit per invoice (USD)", examples=[3000.0])
    human_approval_threshold: float = Field(..., gt=0, description="Threshold for human approval (USD)", examples=[1500.0])
    period_budget: float = Field(..., gt=0, description="Total budget for the period (USD)", examples=[6000.0])

    allowed_currencies: list[str] = Field(default_factory=lambda: ["USD", "EUR"], min_length=1)
    amount_tolerance: float = Field(default=0.0, ge=0, description="Tolerated difference vs agreed (USD)")
    duplicate_window_days: int = Field(default=30, ge=1, description="Duplicate window in days")
    min_confidence: float = Field(default=0.7, ge=0.0, le=1.0, description="Extractor confidence threshold (0.0 to 1.0)")

    @field_validator("allowed_currencies")
    @classmethod
    def currencies_uppercase(cls, v: list[str]) -> list[str]:
        cleaned = [c.strip().upper() for c in v]
        if any(len(c) != 3 for c in cleaned):
            raise ValueError("Each currency must be a 3-letter code")
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("allowed_currencies contains duplicates")
        return cleaned

class RuleUpdate(RuleBase):
    exchange_rates: list[ExchangeRateCreate] = []

    @model_validator(mode="after")
    def check_cross_fields(self):
        rates = {r.currency: r.rate_to_usd for r in self.exchange_rates}
        if len(rates) != len(self.exchange_rates):
            raise ValueError("Duplicate currency in exchange_rates")
        if rates.get("USD") != 1.0:
            raise ValueError("USD must be present in exchange_rates with rate 1.0")
        missing = [c for c in self.allowed_currencies if c not in rates]
        if missing:
            raise ValueError(f"Missing exchange rate for: {', '.join(missing)}")

        if self.human_approval_threshold > self.per_payment_limit:
            raise ValueError(
                "human_approval_threshold cannot be greater than per_payment_limit"
            )
        return self

class RuleResponse(RuleBase):
    id: int
    active: bool
    created_at: datetime
    exchange_rates: list[ExchangeRateResponse] = []

    model_config = ConfigDict(from_attributes=True)