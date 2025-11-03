# Quick Start Guide - Onyx Houseware CRM

## For Local Development

### 1. Initial Setup

```bash
# Clone or download the project
cd onyx-houseware

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your credentials
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=your_password
# SESSION_SECRET=your_secret_key
# DATABASE_URL=server/data/onyx.db
```

### 2. Run Locally

```bash
# Development mode (with hot reload)
npm run dev

# Access at http://localhost:5001
# Login with credentials from .env
```

### 3. Production Build

```bash
# Build the application
npm run build

# Run in production mode
npm start
```

---

## For AWS LightSail Deployment

### Prerequisites

- AWS Account
- Ubuntu 24.04 LTS instance ($5/month minimum)
- Static IP attached
- Domain name

### Quick Deployment Steps

**1. On your server:**

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3

# Upload your code (via git, scp, or rsync)
cd /home/ubuntu/onyx-houseware
npm install
```

**2. Configure environment:**

```bash
nano .env
# Add:
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=YourSecurePassword
# SESSION_SECRET=your-long-random-secret
# PORT=5001
# NODE_ENV=production
# DATABASE_URL=/var/app/data/onyx.db
```

**3. Ensure persistent DB directory:**

```bash
sudo mkdir -p /var/app/data
sudo chown ubuntu:ubuntu /var/app/data
```

**4. Build and run:**

```bash
npm run build

# Install PM2
sudo npm install -g pm2
pm2 start npm --name "onyx-houseware" -- start
pm2 startup systemd
pm2 save
```

**5. Setup Nginx:**

```bash
sudo apt install nginx -y

# Create config file
sudo nano /etc/nginx/sites-available/onyx-houseware
# (Copy configuration from DEPLOYMENT.md)

sudo ln -s /etc/nginx/sites-available/onyx-houseware /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**5. Setup SSL (if you have a domain):**

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Done!** Access your app at `http://YOUR_IP` or `https://yourdomain.com`

---

## Database Schema Changes

### Understanding the System

This app uses **SQLite with Bootstrap + Drizzle ORM**:
- **Schema**: `shared/schema.ts` (TypeScript definitions)
- **Bootstrap**: `server/db/bootstrap.ts` (auto-creates tables on startup)
- **Database Paths**:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db` (persistent across redeploys)

### Development Workflow (Fast Iteration)

**1. Modify Schema**

Edit `shared/schema.ts`:

```typescript
export const items = sqliteTable("items", {
  // ... existing fields ...
  discount: real("discount").default(0), // NEW!
});
```

**2. Sync to Database**

**Why `db:push`?**
- ✅ Instantly applies schema changes to your local database
- ✅ No manual SQL needed
- ✅ Perfect for development
- ⚠️ Use only in development, not production

```bash
# Backup first!
cp server/data/onyx.db server/data/onyx.db.backup

# Apply schema changes
npm run db:push

# If you get warnings about data loss:
npm run db:push -- --force
```

**3. Update Code & Test**

```bash
# Update server/storage.ts and routes if needed
npm run dev
# Test your changes
```

### Production Workflow (Safe & Repeatable)

**For New Tables:** Add to `server/db/bootstrap.ts` CREATE TABLES section:

```typescript
await db.run(sql`
  CREATE TABLE IF NOT EXISTS new_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )
`);
```

**For Column Changes:** Add to `server/db/bootstrap.ts` SCHEMA MIGRATIONS section:

```typescript
await addColumnIfNotExists(
  "items",                      // table
  "discount REAL DEFAULT 0",    // column definition
  "discount"                    // name (for logging)
);
```

**Deploy:**

```bash
# On production server
cd /home/ubuntu/onyx-houseware
git pull
npm install
npm run build
pm2 restart onyx-houseware

# Bootstrap runs automatically and applies schema changes!
```

### Quick Comparison

| | Development | Production |
|---|---|---|
| **Tool** | `npm run db:push` | Bootstrap helpers |
| **Speed** | ⚡ Instant | 🔄 On restart |
| **Safe to re-run?** | ❌ No | ✅ Yes (forever!) |
| **When to use** | Local testing | Deployments |

---

## Essential PM2 Commands

```bash
pm2 status                   # Check app status
pm2 logs onyx-houseware     # View logs
pm2 restart onyx-houseware  # Restart app
pm2 stop onyx-houseware     # Stop app
pm2 delete onyx-houseware   # Remove from PM2
pm2 monit                   # Monitor resources
```

---

## Backup Database

```bash
# Manual backup
cp /var/app/data/onyx.db /home/ubuntu/backups/onyx-$(date +%Y%m%d).db

# Or dump as SQL
sqlite3 /var/app/data/onyx.db .dump > /home/ubuntu/backups/onyx-$(date +%Y%m%d).sql

# Restore backup
# From .db file
cp /home/ubuntu/backups/onyx-20250116.db /var/app/data/onyx.db

# From .sql dump
sqlite3 /var/app/data/onyx.db < /home/ubuntu/backups/onyx-20250116.sql

pm2 restart onyx-houseware
```

---

## Updating Your App

```bash
# On server
cd /home/ubuntu/onyx-houseware
git pull  # or upload new files
npm install
npm run build
pm2 restart onyx-houseware
```

---

## Troubleshooting

**App won't start:**

```bash
pm2 logs onyx-houseware --lines 100
# Check for errors in .env or missing dependencies
```

**Can't access via browser:**

```bash
# Check firewall in AWS LightSail console
# Ensure ports 80, 443 are open
sudo systemctl status nginx
curl http://localhost:5000
```

**Database issues:**

```bash
ls -l /var/app/data/onyx.db  # Check permissions
df -h                        # Check disk space
```

---

## Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide with detailed explanations.

---

**Need Help?**

- Check `pm2 logs onyx-houseware`
- Review `/var/log/nginx/error.log`
- Verify `.env` configuration
