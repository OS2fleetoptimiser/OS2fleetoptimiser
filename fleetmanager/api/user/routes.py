from datetime import datetime
import pytz
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..dependencies import get_session
from fleetmanager.data_access.dbschema import UserLogin


router = APIRouter(
    prefix="/user",
)

cph_tz = pytz.timezone('Europe/Copenhagen')


@router.get("/{user_id}/login")
def get_login_datetime(user_id: str, db: Session = Depends(get_session)):
    user_login = db.query(UserLogin).filter(UserLogin.user_id == user_id).first()
    if user_login:
        return {"user_id": user_id, "last_seen_date": user_login.last_seen_date}
    return {"user_id": user_id, "last_seen_date": None}


@router.patch("/{user_id}/login")
def update_login_datetime(user_id: str, db: Session = Depends(get_session)):
    now_cph = datetime.now(cph_tz)
    user_login = db.query(UserLogin).filter(UserLogin.user_id == user_id).first()

    if not user_login:
        user_login = UserLogin(user_id=user_id, last_seen_date=now_cph)
        db.add(user_login)
        last_seen = now_cph
    else:
        last_seen = user_login.last_seen_date
        user_login.last_seen_date = now_cph

    db.commit()
    db.refresh(user_login)

    return {"user_id": user_login.user_id, "last_seen_date": last_seen}
