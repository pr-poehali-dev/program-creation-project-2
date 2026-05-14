"""
Поиск приватного ключа биткоин-пазла #71 методом случайного перебора.
Диапазон: 2^70 до 2^71 - 1.
Роутинг через query param: ?action=start|scan|stats|history
"""
import os
import json
import random
import hashlib
import time
import psycopg2
import coincurve

TARGET_ADDRESS = "1LzhS3k3e9Ub8i2W1V8xQFdB8n2MYCHPCa"
RANGE_MIN = 2 ** 70
RANGE_MAX = 2 ** 71 - 1

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}


def privkey_to_address(privkey_int: int) -> str:
    privkey_bytes = privkey_int.to_bytes(32, "big")
    key = coincurve.PublicKey.from_valid_secret(privkey_bytes)
    pubkey_compressed = key.format(compressed=True)
    sha256_hash = hashlib.sha256(pubkey_compressed).digest()
    ripemd160 = hashlib.new("ripemd160")
    ripemd160.update(sha256_hash)
    pubkey_hash = ripemd160.digest()
    versioned = b"\x00" + pubkey_hash
    checksum = hashlib.sha256(hashlib.sha256(versioned).digest()).digest()[:4]
    address_bytes = versioned + checksum
    alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    num = int.from_bytes(address_bytes, "big")
    result = []
    while num > 0:
        num, remainder = divmod(num, 58)
        result.append(alphabet[remainder])
    for byte in address_bytes:
        if byte == 0:
            result.append("1")
        else:
            break
    return "".join(reversed(result))


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            body = {}

    if action == "start":
        session_id = body.get("session_id", str(int(time.time())))
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "INSERT INTO puzzle_sessions (session_id, status) VALUES (%s, 'running')",
            (session_id,),
        )
        db.commit()
        cur.close()
        db.close()
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"ok": True, "session_id": session_id}),
        }

    if action == "scan":
        session_id = body.get("session_id", "default")
        batch = min(int(body.get("batch", 500)), 2000)
        found_key = None
        found_address = None
        last_key_hex = None
        checked = 0
        for _ in range(batch):
            privkey_int = random.randint(RANGE_MIN, RANGE_MAX)
            address = privkey_to_address(privkey_int)
            last_key_hex = hex(privkey_int)
            checked += 1
            if address == TARGET_ADDRESS:
                found_key = hex(privkey_int)
                found_address = address
                break
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "UPDATE puzzle_sessions SET keys_checked = keys_checked + %s WHERE session_id = %s",
            (checked, session_id),
        )
        if found_key:
            cur.execute(
                "INSERT INTO puzzle_found (session_id, private_key, address) VALUES (%s, %s, %s)",
                (session_id, found_key, found_address),
            )
            cur.execute(
                "UPDATE puzzle_sessions SET status = 'found', stopped_at = NOW() WHERE session_id = %s",
                (session_id,),
            )
        db.commit()
        cur.close()
        db.close()
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "checked": checked,
                "found": found_key is not None,
                "private_key": found_key,
                "address": found_address,
                "last_key": last_key_hex,
            }),
        }

    if action == "stats":
        session_id = params.get("session_id", "")
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "SELECT keys_checked, status, started_at FROM puzzle_sessions WHERE session_id = %s",
            (session_id,),
        )
        row = cur.fetchone()
        found_rows = []
        if row:
            cur.execute(
                "SELECT private_key, address, found_at FROM puzzle_found WHERE session_id = %s ORDER BY found_at DESC LIMIT 5",
                (session_id,),
            )
            found_rows = [{"private_key": r[0], "address": r[1], "found_at": str(r[2])} for r in cur.fetchall()]
        cur.close()
        db.close()
        if not row:
            return {
                "statusCode": 404,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "session not found"}),
            }
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "keys_checked": row[0],
                "status": row[1],
                "started_at": str(row[2]),
                "found": found_rows,
            }),
        }

    if action == "history":
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "SELECT s.session_id, s.keys_checked, s.status, s.started_at, "
            "f.private_key, f.address, f.found_at "
            "FROM puzzle_sessions s LEFT JOIN puzzle_found f ON s.session_id = f.session_id "
            "ORDER BY s.started_at DESC LIMIT 50"
        )
        rows = cur.fetchall()
        cur.close()
        db.close()
        sessions = [
            {
                "session_id": r[0],
                "keys_checked": r[1],
                "status": r[2],
                "started_at": str(r[3]),
                "private_key": r[4],
                "address": r[5],
                "found_at": str(r[6]) if r[6] else None,
            }
            for r in rows
        ]
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"sessions": sessions}),
        }

    return {
        "statusCode": 400,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": "use ?action=start|scan|stats|history"}),
    }
