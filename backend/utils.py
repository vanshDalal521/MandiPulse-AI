from pydantic import BaseModel
from typing import List

def log_event(db, event_type: str, entity_id: int, agent: str, reason: str = None, previous_state: str = None, new_state: str = None):
    """Create an AgentEvent record.
    Used by other endpoints to keep an audit trail.
    """
    from . import models
    event = models.AgentEvent(
        event_type=event_type,
        entity_id=entity_id,
        agent=agent,
        reason=reason,
        previous_state=previous_state,
        new_state=new_state,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
