import json
import hashlib
import hmac
import os
import sqlite3
from pathlib import Path
from urllib.parse import parse_qsl, unquote

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
MODERATOR_IDS = [int(x) for x in os.getenv("MODERATOR_IDS", "7064365721").split(",") if x]

# Path to shared resources (one level up)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
RATES_FILE = BASE_DIR / "exchange_rate.json"
USERS_DB   = BASE_DIR / "users.db"
ORDERS_DB  = BASE_DIR / "orders.db"
BALANCE_DB = BASE_DIR / "user_balance.db"
FINANCE_DB = BASE_DIR / "finance.db"

app = FastAPI(title="RYExchange Mini App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def db(path: Path):
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


def validate_init_data(init_data: str) -> dict:
    """Validate Telegram WebApp initData and return user dict."""
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    hash_value = parsed.pop("hash", "")
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    computed   = hmac.new(secret_key, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, hash_value):
        raise HTTPException(status_code=401, detail="Invalid Telegram auth")
    import json as _json
    user_raw = parsed.get("user", "{}")
    return _json.loads(unquote(user_raw))


def get_current_user(x_init_data: str = Header(...)):
    return validate_init_data(x_init_data)


def get_mod_user(user: dict = Depends(get_current_user)):
    if user.get("id") not in MODERATOR_IDS:
        raise HTTPException(status_code=403, detail="Not a moderator")
    return user


# ── Rates ─────────────────────────────────────────────────────────────────────

@app.get("/api/rates")
def get_rates():
    try:
        data = json.loads(RATES_FILE.read_text(encoding="utf-8"))
    except Exception:
        data = {"rub": 12.25, "usdt_cny": 6.78, "min_amount": 300.0, "max_amount": 10000.0,
                "work_time": {"start_h": 11, "end_h": 21}}
    return data


# ── User ──────────────────────────────────────────────────────────────────────

@app.get("/api/me")
def get_me(user: dict = Depends(get_current_user)):
    uid = user["id"]
    with db(USERS_DB) as conn:
        row = conn.execute("SELECT * FROM users WHERE user_id = ?", (uid,)).fetchone()
    with db(BALANCE_DB) as conn:
        bal = conn.execute("SELECT balance FROM balances WHERE user_id = ?", (uid,)).fetchone()

    balance = bal["balance"] if bal else 0
    if row:
        return {**dict(row), "bonus_balance": balance}
    return {"user_id": uid, "registered": False, "bonus_balance": balance}


@app.get("/api/me/orders")
def get_my_orders(user: dict = Depends(get_current_user)):
    uid = user["id"]
    with db(ORDERS_DB) as conn:
        rows = conn.execute(
            "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", (uid,)
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/me/referral")
def get_referral(user: dict = Depends(get_current_user)):
    uid = user["id"]
    with db(USERS_DB) as conn:
        count = conn.execute(
            "SELECT COUNT(*) as cnt FROM users WHERE referrer_id = ?", (uid,)
        ).fetchone()["cnt"]
    with db(BALANCE_DB) as conn:
        bal = conn.execute("SELECT balance FROM balances WHERE user_id = ?", (uid,)).fetchone()
    return {"referral_count": count, "bonus_balance": bal["balance"] if bal else 0}


# ── Orders ────────────────────────────────────────────────────────────────────

class OrderIn(BaseModel):
    exchange_type: str        # rub_to_cny | usdt_to_cny | cny_to_rub
    amount: float
    used_bonus: Optional[float] = 0


@app.post("/api/orders")
def create_order(body: OrderIn, user: dict = Depends(get_current_user)):
    uid = user["id"]
    # Check user is registered & verified
    with db(USERS_DB) as conn:
        row = conn.execute("SELECT * FROM users WHERE user_id = ?", (uid,)).fetchone()
    if not row:
        raise HTTPException(400, "Пользователь не зарегистрирован в боте")
    if row["is_verified"] != 1:
        raise HTTPException(400, "Аккаунт ещё не верифицирован")

    # Rates
    rates = get_rates()
    rub_rate  = rates.get("rub", 12.25)
    usdt_rate = rates.get("usdt_cny", 6.78)

    et = body.exchange_type
    if et == "rub_to_cny":
        result_cny = body.amount / rub_rate
    elif et == "usdt_to_cny":
        result_cny = body.amount * usdt_rate
    elif et == "cny_to_rub":
        result_cny = body.amount
    else:
        raise HTTPException(400, "Неверный тип обмена")

    with db(ORDERS_DB) as conn:
        # Get next order number for user
        num_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?", (uid,)
        ).fetchone()
        user_order_number = (num_row["cnt"] or 0) + 1

        conn.execute(
            """INSERT INTO orders
               (user_id, exchange_type, amount, result_cny, used_bonus, status, created_at, user_order_number)
               VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), ?)""",
            (uid, et, body.amount, round(result_cny, 2), body.used_bonus or 0, user_order_number)
        )
        order_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    return {"order_id": order_id, "result_cny": round(result_cny, 2), "status": "pending"}


# ── Moderator ─────────────────────────────────────────────────────────────────

@app.get("/api/mod/orders")
def mod_orders(status: str = "pending", _mod=Depends(get_mod_user)):
    with db(ORDERS_DB) as conn:
        rows = conn.execute(
            "SELECT o.*, u.full_name, u.phone FROM orders o "
            "LEFT JOIN users u ON o.user_id = u.user_id "
            "WHERE o.status = ? ORDER BY o.created_at DESC LIMIT 100",
            (status,)
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/mod/users")
def mod_users(verified: Optional[int] = None, _mod=Depends(get_mod_user)):
    with db(USERS_DB) as conn:
        if verified is None:
            rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC LIMIT 100").fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM users WHERE is_verified = ? ORDER BY created_at DESC LIMIT 100",
                (verified,)
            ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/mod/orders/{order_id}/close")
def mod_close_order(order_id: int, _mod=Depends(get_mod_user)):
    with db(ORDERS_DB) as conn:
        row = conn.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Заявка не найдена")
        conn.execute("UPDATE orders SET status = 'done' WHERE order_id = ?", (order_id,))
    # Referral bonus
    with db(USERS_DB) as conn:
        u = conn.execute("SELECT referrer_id FROM users WHERE user_id = ?", (row["user_id"],)).fetchone()
    if u and u["referrer_id"]:
        with db(BALANCE_DB) as conn:
            conn.execute(
                "INSERT INTO balances(user_id, balance) VALUES(?,80) "
                "ON CONFLICT(user_id) DO UPDATE SET balance = balance + 80",
                (u["referrer_id"],)
            )
    return {"ok": True}


@app.post("/api/mod/users/{user_id}/verify")
def mod_verify_user(user_id: int, _mod=Depends(get_mod_user)):
    with db(USERS_DB) as conn:
        conn.execute("UPDATE users SET is_verified = 1 WHERE user_id = ?", (user_id,))
    return {"ok": True}


@app.get("/api/mod/stats")
def mod_stats(_mod=Depends(get_mod_user)):
    with db(ORDERS_DB) as conn:
        pending = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status='pending'").fetchone()["c"]
        done    = conn.execute("SELECT COUNT(*) as c FROM orders WHERE status='done'").fetchone()["c"]
    with db(USERS_DB) as conn:
        users_total    = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
        users_unverif  = conn.execute("SELECT COUNT(*) as c FROM users WHERE is_verified=0").fetchone()["c"]
    return {
        "orders_pending": pending,
        "orders_done": done,
        "users_total": users_total,
        "users_unverified": users_unverif,
    }
