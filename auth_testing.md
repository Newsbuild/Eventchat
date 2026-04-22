# Auth Testing Playbook

## Credentials
- Admin: `admin@event.local` / `admin123`
- Users: `anna@event.local`, `ben@event.local`, `clara@event.local` / `demo123`

## API Testing
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -c /tmp/cookies.txt -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@event.local","password":"admin123"}'
curl -b /tmp/cookies.txt "$API/api/auth/me"
```

Expected: login returns user object + sets `access_token`,`refresh_token` cookies. `/me` returns same user.

## MongoDB Verification
```
mongosh
use event_chat
db.users.findOne({role:"admin"},{password_hash:1})  # must start with $2b$
```
