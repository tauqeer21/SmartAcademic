from database import get_db, USE_PG

def qm(sql): return sql.replace("?","%s") if USE_PG else sql

def fetchall(sql, params=()):
    conn = get_db()
    try:
        if USE_PG:
            c = conn.cursor(); c.execute(qm(sql), params); return [dict(r) for r in c.fetchall()]
        else:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally: conn.close()

def fetchone(sql, params=()):
    conn = get_db()
    try:
        if USE_PG:
            c = conn.cursor(); c.execute(qm(sql), params); r = c.fetchone(); return dict(r) if r else None
        else:
            r = conn.execute(sql, params).fetchone(); return dict(r) if r else None
    finally: conn.close()

def execute(sql, params=()):
    conn = get_db()
    try:
        if USE_PG:
            c = conn.cursor(); c.execute(qm(sql), params)
            lid = None
            if sql.strip().upper().startswith("INSERT"):
                c.execute("SELECT lastval()"); lid = c.fetchone()[0]
        else:
            c = conn.execute(sql, params); lid = c.lastrowid
        conn.commit(); return lid
    finally: conn.close()

def executemany(sql, params_list):
    conn = get_db()
    try:
        if USE_PG:
            c = conn.cursor()
            for p in params_list: c.execute(qm(sql), p)
        else: conn.executemany(sql, params_list)
        conn.commit()
    finally: conn.close()
