"""Event-Chat backend regression tests."""
import io
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://event-chat-live.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "admin@event.local", "password": "admin123"}
ANNA = {"email": "anna@event.local", "password": "demo123"}
BEN = {"email": "ben@event.local", "password": "demo123"}
CLARA = {"email": "clara@event.local", "password": "demo123"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text}"
    assert s.cookies.get("access_token"), "access_token cookie missing"
    assert s.cookies.get("refresh_token"), "refresh_token cookie missing"
    return s, r.json()


@pytest.fixture(scope="module")
def admin():
    s, u = _login(ADMIN); return s, u


@pytest.fixture(scope="module")
def anna():
    s, u = _login(ANNA); return s, u


@pytest.fixture(scope="module")
def ben():
    s, u = _login(BEN); return s, u


@pytest.fixture(scope="module")
def clara():
    s, u = _login(CLARA); return s, u


# ---------- Auth ----------
def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "x@y.z", "password": "bad"}, timeout=20)
    assert r.status_code == 401

def test_me(anna):
    s, u = anna
    r = s.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 200
    assert r.json()["email"] == ANNA["email"]

def test_logout_roundtrip():
    s, _ = _login(CLARA)
    r = s.post(f"{API}/auth/logout", timeout=20); assert r.status_code == 200
    # Session.cookies still holds old values even if server deletes them; use fresh session
    r2 = requests.get(f"{API}/auth/me", timeout=20); assert r2.status_code == 401


# ---------- Users ----------
def test_list_users_authenticated(anna):
    s, _ = anna
    r = s.get(f"{API}/users", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) >= 4

def test_list_users_unauthorized():
    r = requests.get(f"{API}/users", timeout=20); assert r.status_code == 401

def test_user_crud_admin_only(admin, anna):
    s_admin, _ = admin; s_anna, _ = anna
    email = f"test_{uuid.uuid4().hex[:8]}@event.local"
    # non-admin forbidden
    r = s_anna.post(f"{API}/users", json={"email": email, "password": "p", "name": "T"}, timeout=20)
    assert r.status_code == 403
    # admin create
    r = s_admin.post(f"{API}/users", json={"email": email, "password": "pass123", "name": "TestUser"}, timeout=20)
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    assert r.json()["email"] == email
    # update
    r = s_admin.patch(f"{API}/users/{uid}", json={"name": "RenamedT"}, timeout=20); assert r.status_code == 200
    r = s_admin.get(f"{API}/users/{uid}", timeout=20); assert r.json()["name"] == "RenamedT"
    # non-admin cannot update
    r = s_anna.patch(f"{API}/users/{uid}", json={"name": "Hack"}, timeout=20); assert r.status_code == 403
    # delete self forbidden
    admin_id = s_admin.get(f"{API}/auth/me", timeout=20).json()["id"]
    r = s_admin.delete(f"{API}/users/{admin_id}", timeout=20); assert r.status_code == 400
    # delete other
    r = s_admin.delete(f"{API}/users/{uid}", timeout=20); assert r.status_code == 200
    r = s_admin.get(f"{API}/users/{uid}", timeout=20); assert r.status_code == 404


# ---------- Chats ----------
def test_direct_chat_create_and_idempotent(anna, ben):
    sa, ua = anna; sb, ub = ben
    r1 = sa.post(f"{API}/chats/direct", json={"user_id": ub["id"]}, timeout=20)
    assert r1.status_code == 200
    c1 = r1.json(); assert c1["type"] == "direct"
    r2 = sa.post(f"{API}/chats/direct", json={"user_id": ub["id"]}, timeout=20)
    assert r2.json()["id"] == c1["id"]

def test_group_chat_and_messages(anna, ben, clara):
    sa, ua = anna; sb, ub = ben; sc, uc = clara
    # create group
    r = sa.post(f"{API}/chats/group", json={"name": f"TEST_Grp_{uuid.uuid4().hex[:6]}",
                                             "member_ids": [ub["id"], uc["id"]]}, timeout=20)
    assert r.status_code == 200
    g = r.json(); gid = g["id"]
    assert ua["id"] in g["member_ids"] and ub["id"] in g["member_ids"]
    # list chats reflects membership
    chats = sa.get(f"{API}/chats", timeout=20).json()
    assert any(c["id"] == gid for c in chats)
    # get chat detail (with members)
    r = sb.get(f"{API}/chats/{gid}", timeout=20); assert r.status_code == 200
    assert "members" in r.json() and len(r.json()["members"]) == 3
    # send message as anna
    r = sa.post(f"{API}/chats/{gid}/messages", json={"text": "hallo welt"}, timeout=20)
    assert r.status_code == 200; mid = r.json()["id"]
    # empty rejected
    r = sa.post(f"{API}/chats/{gid}/messages", json={}, timeout=20); assert r.status_code == 400
    # list messages
    msgs = sb.get(f"{API}/chats/{gid}/messages", timeout=20).json()
    assert any(m["id"] == mid for m in msgs)
    # non-member forbidden: admin session is not member
    s_admin, _ = _login(ADMIN)
    r = s_admin.get(f"{API}/chats/{gid}/messages", timeout=20); assert r.status_code == 404
    return gid, mid

def test_hide_chat(anna, ben):
    sa, ua = anna; sb, ub = ben
    r = sa.post(f"{API}/chats/direct", json={"user_id": ub["id"]}, timeout=20)
    cid = r.json()["id"]
    sa.post(f"{API}/chats/{cid}/hide", timeout=20)
    chats = sa.get(f"{API}/chats", timeout=20).json()
    assert not any(c["id"] == cid for c in chats)
    # recreate unhides
    r = sa.post(f"{API}/chats/direct", json={"user_id": ub["id"]}, timeout=20)
    assert r.json()["id"] == cid
    chats = sa.get(f"{API}/chats", timeout=20).json()
    assert any(c["id"] == cid for c in chats)


# ---------- Groups admin actions ----------
def test_group_admin_flows(anna, ben, clara):
    sa, ua = anna; sb, ub = ben; sc, uc = clara
    r = sa.post(f"{API}/chats/group", json={"name": "TEST_Adm", "member_ids": [ub["id"]]}, timeout=20)
    gid = r.json()["id"]
    # add member (as admin anna)
    r = sa.post(f"{API}/groups/{gid}/members", json={"user_ids": [uc["id"]]}, timeout=20)
    assert r.status_code == 200 and uc["id"] in r.json()["member_ids"]
    # non-admin cannot rename
    r = sb.patch(f"{API}/groups/{gid}", json={"name": "Hacked"}, timeout=20); assert r.status_code == 403
    # rename
    r = sa.patch(f"{API}/groups/{gid}", json={"name": "TEST_Renamed"}, timeout=20); assert r.status_code == 200
    # promote ben
    r = sa.post(f"{API}/groups/{gid}/admin", json={"user_id": ub["id"], "is_admin": True}, timeout=20)
    assert ub["id"] in r.json()["admin_ids"]
    # remove clara as ben (now admin)
    r = sb.delete(f"{API}/groups/{gid}/members/{uc['id']}", timeout=20); assert r.status_code == 200
    # demote ben
    r = sa.post(f"{API}/groups/{gid}/admin", json={"user_id": ub["id"], "is_admin": False}, timeout=20)
    assert ub["id"] not in r.json()["admin_ids"]


# ---------- Uploads ----------
def test_uploads_flow(anna, ben):
    sa, ua = anna; sb, ub = ben
    cid = sa.post(f"{API}/chats/direct", json={"user_id": ub["id"]}, timeout=20).json()["id"]
    files = {"file": ("hello.txt", b"hello world", "text/plain")}
    r = sa.post(f"{API}/uploads", data={"chat_id": cid}, files=files, timeout=20)
    assert r.status_code == 200, r.text
    up = r.json(); upid = up["id"]
    # non-member upload -> 404
    sc, _ = _login(CLARA)
    r = sc.post(f"{API}/uploads", data={"chat_id": cid}, files={"file": ("x.txt", b"x", "text/plain")}, timeout=20)
    assert r.status_code == 404
    # download as member
    r = sb.get(f"{API}/uploads/{upid}/download", timeout=20); assert r.status_code == 200
    assert r.content == b"hello world"
    # download as non-member (non-admin) -> 403
    r = sc.get(f"{API}/uploads/{upid}/download", timeout=20); assert r.status_code == 403
    # admin can download
    s_admin, _ = _login(ADMIN)
    r = s_admin.get(f"{API}/uploads/{upid}/download", timeout=20); assert r.status_code == 200


# ---------- Reports + moderation ----------
def test_reports_and_moderation(anna, ben):
    sa, ua = anna; sb, ub = ben
    gid = sa.post(f"{API}/chats/group", json={"name": "TEST_Rep", "member_ids": [ub["id"]]}, timeout=20).json()["id"]
    mid = sa.post(f"{API}/chats/{gid}/messages", json={"text": "bad text"}, timeout=20).json()["id"]
    # non-member cannot report
    sc, _ = _login(CLARA)
    r = sc.post(f"{API}/messages/{mid}/report", json={"reason": "spam"}, timeout=20); assert r.status_code == 403
    # member report
    r = sb.post(f"{API}/messages/{mid}/report", json={"reason": "spam"}, timeout=20)
    assert r.status_code == 200; rid = r.json()["id"]
    # admin lists reports (enriched)
    s_admin, _ = _login(ADMIN)
    reports = s_admin.get(f"{API}/admin/reports", timeout=20).json()
    me = [x for x in reports if x["id"] == rid][0]
    assert me["message"]["text"] == "bad text"
    assert me["reporter"]["email"] == BEN["email"]
    assert me["chat"]["id"] == gid
    # keep action
    r = s_admin.post(f"{API}/admin/reports/{rid}/resolve", params={"action": "keep"}, timeout=20)
    assert r.status_code == 200 and r.json()["status"] == "resolved_kept"
    # create another and delete
    mid2 = sa.post(f"{API}/chats/{gid}/messages", json={"text": "another"}, timeout=20).json()["id"]
    rid2 = sb.post(f"{API}/messages/{mid2}/report", json={"reason": "x"}, timeout=20).json()["id"]
    r = s_admin.post(f"{API}/admin/reports/{rid2}/resolve", params={"action": "delete"}, timeout=20)
    assert r.json()["status"] == "resolved_deleted"
    # moderation log
    log = s_admin.get(f"{API}/admin/moderation-log", timeout=20).json()
    assert any(l["action"] == "delete" and l["target_id"] == mid2 for l in log)


# ---------- Admin privacy ----------
def test_admin_stats_and_privacy(anna):
    sa, _ = anna
    # normal user forbidden
    r = sa.get(f"{API}/admin/stats", timeout=20); assert r.status_code == 403
    r = sa.get(f"{API}/admin/chats", timeout=20); assert r.status_code == 403
    r = sa.get(f"{API}/admin/groups", timeout=20); assert r.status_code == 403
    r = sa.get(f"{API}/admin/uploads", timeout=20); assert r.status_code == 403
    r = sa.get(f"{API}/admin/reports", timeout=20); assert r.status_code == 403

    s_admin, _ = _login(ADMIN)
    stats = s_admin.get(f"{API}/admin/stats", timeout=20).json()
    for k in ["users","chats","messages","direct_chats","group_chats","reports_pending","uploads","server_time"]:
        assert k in stats
    # chats metadata should NOT leak message text
    meta = s_admin.get(f"{API}/admin/chats", timeout=20).json()
    assert isinstance(meta, list) and len(meta) >= 1
    for c in meta:
        assert "text" not in c and "last_message" not in c
        assert "message_count" in c and "member_count" in c
    # groups list
    groups = s_admin.get(f"{API}/admin/groups", timeout=20).json()
    assert all(g["type"] == "group" for g in groups)


# ---------- Admin upload + delete ----------
def test_admin_upload_and_delete():
    s_admin, _ = _login(ADMIN)
    r = s_admin.post(f"{API}/admin/uploads", data={"note": "TEST_note"},
                     files={"file": ("a.txt", b"admin-file", "text/plain")}, timeout=20)
    assert r.status_code == 200; upid = r.json()["id"]
    items = s_admin.get(f"{API}/admin/uploads", timeout=20).json()
    assert any(i["id"] == upid for i in items)
    r = s_admin.delete(f"{API}/admin/uploads/{upid}", timeout=20); assert r.status_code == 200
    items = s_admin.get(f"{API}/admin/uploads", timeout=20).json()
    assert any(i["id"] == upid and i.get("deleted") for i in items)


# ---------- Profile ----------
def test_me_profile_update():
    s, _ = _login(CLARA)
    r = s.patch(f"{API}/me/profile", json={"name": "Clara Updated"}, timeout=20)
    assert r.status_code == 200 and r.json()["name"] == "Clara Updated"
    # revert
    s.patch(f"{API}/me/profile", json={"name": "Clara Weber"}, timeout=20)
