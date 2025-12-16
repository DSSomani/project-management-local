# Version Information

## Local Version (Current)

**Branch:** `frameWork` (or local-only branch)  
**Last Updated:** December 17, 2025

### Features
- ✅ 100% offline functionality
- ✅ localStorage-based data storage
- ✅ Simple authentication (demo credentials)
- ✅ Project management with tasks and sessions
- ✅ Habit and spending tracking
- ✅ Notes with markdown support
- ✅ Dark mode
- ✅ Export functionality (JSON, CSV)

### Limitations
- ❌ No cloud backup
- ❌ No multi-device sync
- ❌ Single browser only
- ❌ 5-10MB storage limit
- ❌ No real authentication

### Best For
- Personal use
- Offline scenarios
- Privacy-focused users
- Testing and development
- Users who don't need cloud features

---

## Supabase Version

**Branch:** Available separately  
**Status:** Cloud-enabled with backend

### Additional Features
- ✅ Cloud database (Supabase)
- ✅ Real authentication
- ✅ Multi-device sync
- ✅ Unlimited storage
- ✅ Multi-user support
- ✅ Automatic backups
- ✅ Row-level security (RLS)

### Requirements
- Internet connection
- Supabase account
- Configuration setup

### Best For
- Production use
- Multi-device access
- Team collaboration
- Users needing cloud backup
- Applications requiring real auth

---

## Migration Guide

### From Local to Supabase

1. **Export your data** from the local version
2. **Set up Supabase** account and project
3. **Run schema** from `supabase-schema.sql` (available in Supabase branch)
4. **Import data** to Supabase tables
5. **Configure** Supabase credentials
6. **Switch** to Supabase branch

### From Supabase to Local

1. **Export data** from Supabase
2. **Clear localStorage** in browser
3. **Switch** to local-only branch
4. **Import data** via browser console or manually

---

## Demo Credentials (Local Version Only)

```
Email: demo@local.com
Password: demo123

Email: admin@local.com
Password: admin123
```

**Note:** These are hardcoded for demo purposes. Modify in `login.html` if needed.

---

## File Differences

### Local Version Includes:
- `login.html` - Simple localStorage authentication
- `index.html` - No Supabase script tags
- `app.js` - Pure localStorage implementation
- `SECURITY-FIXES.md` - Local security documentation

### Local Version EXCLUDES:
- ❌ `supabase.js` - Supabase helper functions
- ❌ `supabase-schema.sql` - Database schema
- ❌ Supabase CDN scripts
- ❌ Network requests for data operations

### Supabase Version Includes:
- All local version files
- `supabase.js` - Supabase integration
- `supabase-schema.sql` - Database setup
- Supabase authentication flow
- Cloud data sync

---

## Technical Details

### Local Version Stack
- HTML5
- CSS3 (with custom properties)
- Vanilla JavaScript
- localStorage API
- No dependencies

### Supabase Version Stack
- HTML5
- CSS3
- Vanilla JavaScript
- localStorage (fallback)
- Supabase JS Client
- PostgreSQL (via Supabase)

---

## Support

For issues specific to:
- **Local version:** Check `SECURITY-FIXES.md` and `README.md`
- **Supabase version:** Refer to Supabase documentation

## License

[Include your license information here]
