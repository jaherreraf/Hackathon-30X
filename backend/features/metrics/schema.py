from pydantic import BaseModel

class MetricsResponse(BaseModel):
    total: int
    paid: int                 
    held: int                 
    escalated: int           
    pending: int             
    human_approved: int      
    human_rejected: int       
    autonomy_pct: float      
    payments_outside_rules: int
    period_budget: float
    spent_budget: float
    available_budget: float