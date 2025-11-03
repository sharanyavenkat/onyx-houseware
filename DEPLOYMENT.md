# Onyx Houseware Order Management System - Deployment Guide

This guide covers everything you need to download, configure, run locally, and deploy your application to AWS LightSail.

---

## Table of Contents

1. [Download from Github](#download-from-github)
2. [Local Setup](#local-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Schema Changes](#database-schema-changes)
5. [Running Locally](#running-locally)
6. [AWS LightSail Deployment](#aws-lightsail-deployment)
7. [Post-Deployment Configuration](#post-deployment-configuration)
8. [Important Considerations](#important-considerations)

---

## Download from Github

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

---

## Local Setup

### Prerequisites

- **Node.js** 20.x or later (check with `node --version`)
- **npm** 10.x or later (check with `npm --version`)
- **Git** (optional, for version control)

### Install Dependencies

```bash
cd onyx-houseware  # or your project directory name
npm install
```

This will install all required packages including:

- Express.js (backend server)
- React (frontend)
- SQLite & Drizzle ORM (database)
- All UI components and dependencies

---

## Environment Configuration

### 1. Create Environment File

```bash
# Copy the example file
cp .env.example .env

# Or create .env manually
touch .env
```

### 2. Configure `.env` File

Edit `.env` with your production values:

```env
# Authentication
# IMPORTANT: Change these credentials for production!
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123!

# Session Configuration
# IMPORTANT: Generate a strong random secret for production!
# You can generate one with: openssl rand -base64 32
SESSION_SECRET=your-very-long-random-secret-key-here-min-32-chars

# Application Configuration
PORT=5001
NODE_ENV=production
```

**⚠️ SECURITY CRITICAL:**

- Never use `admin123` as password in production
- Generate a strong `SESSION_SECRET` (minimum 32 characters)
- Keep `.env` file secure and never commit it to version control

### Generate Secure Session Secret

```bash
# On Linux/Mac
openssl rand -base64 48

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

---

## Database Schema Changes

### Understanding the Database System

This application uses **SQLite** with **Drizzle ORM** and a **bootstrap-based migration approach**.

**Key Concepts:**
- **Schema**: Defined in `shared/schema.ts` (TypeScript definitions)
- **Bootstrap**: Auto-creates tables on startup via `server/db/bootstrap.ts`
- **Development Tool**: `npm run db:push` syncs schema to database instantly (dev only)
- **Production Strategy**: Manual schema migrations via bootstrap helper functions

### Database File Locations

| Environment | Path | Purpose |
|-------------|------|---------|
| **Development** | `server/data/onyx.db` | Local development database |
| **Production** | `/var/app/data/onyx.db` | Persistent across redeploys |

**How it works:**
- The `DATABASE_URL` environment variable controls which path is used
- Bootstrap script automatically creates the directory if it doesn't exist
- Tables auto-create on first run using `CREATE TABLE IF NOT EXISTS`

### Current Database Tables

- `users` - Admin authentication
- `items` - Product catalog with SKU and pricing
- `customers` - Customer information
- `orders` - Order headers with PO numbers
- `order_items` - Order line items
- `indents` - Monthly inventory planning
- `shipments` - Fulfillment tracking with rejections

---

## Making Schema Changes

### Two-Stage Workflow: Development → Production

#### **STAGE 1: Development (Local)**

**Step 1: Modify Schema**

Edit `shared/schema.ts` to add/modify tables or columns:

```typescript
// Example: Adding a new column to items table
export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  // ... existing fields ...

  // NEW FIELD
  discount: real("discount").default(0), // Add discount field
});
```

**Step 2: Sync Schema to Development Database**

**Why use `db:push`?**
- ✅ Instantly syncs `shared/schema.ts` to your local database
- ✅ No need to write manual SQL
- ✅ Perfect for rapid development and testing
- ✅ Shows you what SQL will be executed
- ⚠️ Only for development - can't easily run in production

```bash
# Apply schema changes to development database
npm run db:push
```

If you get data-loss warnings (e.g., changing column types):

```bash
# Backup first!
cp server/data/onyx.db server/data/onyx.db.backup

# Force push (may delete data)
npm run db:push -- --force
```

**What happens:**
- Drizzle compares your schema to the database
- Generates SQL to add/modify/remove columns
- Applies changes instantly
- ✅ Your local database now matches `shared/schema.ts`

**Step 3: Update Storage Interface (if needed)**

If you added new CRUD operations, update `server/storage.ts`:

```typescript
export interface IStorage {
  // Add new methods if needed
  updateItemDiscount(itemId: number, discount: number): Promise<Item>;
}
```

**Step 4: Test Your Changes**

```bash
npm run dev
# Test the new feature thoroughly
```

---

#### **STAGE 2: Production (AWS LightSail)**

Once your changes work locally, you need to deploy them to production. **You can't run `npm run db:push` on the production server** - instead, you use the bootstrap approach.

**For Adding New Tables:**

Update `server/db/bootstrap.ts` in the "CREATE TABLES" section:

```typescript
// Add this to the CREATE TABLES section
await db.run(sql`
  CREATE TABLE IF NOT EXISTS new_table_name (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
```

**Safe to keep forever!** The `IF NOT EXISTS` means it only creates the table once.

**For Modifying Existing Tables (Adding/Removing Columns):**

Use the `addColumnIfNotExists()` helper in the "SCHEMA MIGRATIONS" section:

```typescript
// In server/db/bootstrap.ts, SCHEMA MIGRATIONS section
await addColumnIfNotExists(
  "items",                      // table name
  "discount REAL DEFAULT 0",    // column definition
  "discount"                    // column name (for logging)
);
```

**Safe to keep forever!** The helper catches duplicate column errors automatically.

**Deploy to Production:**

```bash
# On your production server
cd /home/ubuntu/onyx-houseware

# Pull latest code (includes updated bootstrap.ts)
git pull

# Install dependencies (if any new ones)
npm install

# Rebuild application
npm run build

# Restart (bootstrap runs automatically and applies schema changes)
pm2 restart onyx-houseware
```

**What happens on restart:**
- Bootstrap runs on server startup
- Sees new `addColumnIfNotExists()` call
- Adds the column to production database
- Logs: `"✅ Added discount column to items"`
- Future restarts: Column exists, silently ignores (no error!)

---

### Complete Example: Adding a Discount Feature

**Development workflow:**

```bash
# 1. Edit shared/schema.ts - add discount field to items table
# 2. Sync to local database
npm run db:push

# 3. Edit server/storage.ts - add discount methods
# 4. Edit server/routes.ts - add discount API endpoints
# 5. Edit client code - add discount UI
# 6. Test locally
npm run dev
```

**Production workflow:**

```bash
# 7. Update server/db/bootstrap.ts
# Add to SCHEMA MIGRATIONS section:
await addColumnIfNotExists(
  "items",
  "discount REAL DEFAULT 0",
  "discount"
);

# 8. Commit and push to git
git add .
git commit -m "Add discount feature"
git push

# 9. Deploy to production
ssh ubuntu@YOUR_SERVER
cd /home/ubuntu/onyx-houseware
git pull
npm install
npm run build
pm2 restart onyx-houseware

# ✅ Discount column now exists in production!
```

---

### Why Two Different Approaches?

| Aspect | Development (`db:push`) | Production (Bootstrap) |
|--------|------------------------|------------------------|
| **Speed** | ⚡ Instant | 🔄 On restart |
| **Execution** | 🖐️ Manual command | 🤖 Automatic on startup |
| **SQL Generation** | ✅ Auto-generates SQL | 📝 You write SQL manually |
| **Automation** | ❌ Can't add to startup script | ✅ Built into server startup |
| **Error Handling** | ⚠️ Requires manual confirmation | ✅ Handles errors gracefully |
| **Production Ready** | ❌ Hard to run on server | ✅ Designed for production |

**Summary:**
- **Development**: Use `db:push` for fast iteration and testing (manual, interactive)
- **Production**: Use bootstrap for automated, zero-touch deployments (runs on every startup)

---

### Schema Change Best Practices

1. **Always backup before schema changes**

   ```bash
   # Development
   cp server/data/onyx.db server/data/onyx.db.backup
   
   # Production
   cp /var/app/data/onyx.db /var/app/data/onyx.db.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Test locally first** before deploying to production

   ```bash
   # Local testing workflow
   npm run db:push        # Apply schema change
   npm run dev            # Test the feature
   # If it works, then update bootstrap.ts for production
   ```

3. **For production deployments:**

   - Backup the database first
   - Update `bootstrap.ts` with schema change
   - Deploy code
   - Bootstrap runs automatically on restart
   - Verify in logs: `"✅ Added [column] column to [table]"`

4. **Never change primary key types** (e.g., don't change `integer` to `text`)

5. **Use `addColumnIfNotExists()` for column changes** - it's safe to keep forever

6. **Use `CREATE TABLE IF NOT EXISTS` for new tables** - it's safe to keep forever

### Database Backup & Restore

#### Backup

```bash
# Manual backup
cp /var/app/data/onyx.db backups/onyx-$(date +%Y%m%d).db

# Or use SQLite dump
sqlite3 /var/app/data/onyx.db .dump > backups/onyx-$(date +%Y%m%d).sql
```

#### Restore

```bash
# From .db file
cp backups/onyx-20250116.db /var/app/data/onyx.db

# From .sql dump
sqlite3 /var/app/data/onyx.db < backups/onyx-20250116.sql
```

---

## Running Locally

### Development Mode (with hot reload)

```bash
npm run dev
```

- Frontend: Auto-reloads on changes
- Backend: Auto-restarts on changes
- Access: http://localhost:5001
- Login with credentials from `.env`

### Production Build & Run

```bash
# Build the application
npm run build

# Run in production mode
npm start
```

### Verify Everything Works

1. Open browser to http://localhost:5001
2. Login with your admin credentials
3. Test key features:
   - Dashboard loads with stats
   - Can view/create orders
   - Can manage items and customers
   - Indent calculations work correctly

---

## AWS LightSail Deployment

### Prerequisites

- AWS Account
- Domain name (optional, but recommended)
- SSH client

### Step 1: Create LightSail Instance

1. **Go to AWS LightSail Console**

   - https://lightsail.aws.amazon.com/

2. **Create Instance**

   - Click "Create instance"
   - **Region**: Choose closest to your users
   - **Blueprint**: OS Only → Ubuntu 24.04 LTS
   - **Instance Plan**: Start with $5/month (1GB RAM, 1 vCPU)
   - **Instance Name**: `onyx-houseware-prod`

3. **Create & Wait** for instance to be ready

### Step 2: Attach Static IP

1. Go to **Networking** tab
2. Click **"Create static IP"**
3. Attach to your instance
4. Note the IP address (e.g., `52.11.123.45`)

### Step 3: Configure Firewall

In **Networking** tab, add these rules:

- **SSH**: Port 22 (already enabled)
- **HTTP**: Port 80
- **HTTPS**: Port 443
- **Custom**: Port 5001 (for initial testing, remove later)

### Step 4: Connect via SSH

```bash
# Download your SSH key from LightSail
# Connect to your instance
ssh -i /path/to/your-key.pem ubuntu@YOUR_STATIC_IP
```

### Step 5: Install Node.js on Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x
npm --version   # Should show v10.x

# Install build essentials (needed for SQLite)
sudo apt install -y build-essential python3
```

### Step 6: Upload Your Application

**Option A: Using Git (Recommended)**

```bash
# On your server
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git onyx-houseware
cd onyx-houseware
```

**Option B: Using SCP**

```bash
# On your local machine
# First, zip your project (excluding node_modules)
tar -czf onyx-houseware.tar.gz --exclude=node_modules --exclude=.git --exclude=dist .

# Upload to server
scp -i /path/to/your-key.pem onyx-houseware.tar.gz ubuntu@YOUR_STATIC_IP:/home/ubuntu/

# On server
ssh -i /path/to/your-key.pem ubuntu@YOUR_STATIC_IP
cd /home/ubuntu
tar -xzf onyx-houseware.tar.gz -C onyx-houseware
cd onyx-houseware
```

**Option C: Using rsync (Best for updates)**

```bash
# On your local machine
rsync -avz -e "ssh -i /path/to/your-key.pem" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'server/data' \
  ./ ubuntu@YOUR_STATIC_IP:/home/ubuntu/onyx-houseware/
```

### Step 7: Configure Production Environment

```bash
# On server
cd /home/ubuntu/onyx-houseware

# Create .env file
nano .env
```

Paste your production configuration:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecureProductionPassword
SESSION_SECRET=your-very-long-random-secret-from-step-2
PORT=5001
NODE_ENV=production
```

Save and exit (Ctrl+X, Y, Enter)

### Step 8: Install Dependencies & Build

```bash
# Install production dependencies
npm install --production=false

# Build the application
npm run build

# Test that it starts
npm start
```

Visit `http://YOUR_STATIC_IP:5001` to verify it works. Press `Ctrl+C` to stop.

### Step 9: Setup Process Manager (PM2)

PM2 keeps your app running and restarts it if it crashes:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your application
pm2 start npm --name "onyx-houseware" -- start

# Configure PM2 to start on boot
pm2 startup systemd
# Run the command it outputs (starts with sudo)

pm2 save

# Useful PM2 commands:
pm2 status              # Check app status
pm2 logs onyx-houseware # View logs
pm2 restart onyx-houseware  # Restart app
pm2 stop onyx-houseware     # Stop app
```

### Step 10: Setup Nginx Reverse Proxy

Nginx forwards web traffic (port 80/443) to your Node.js app (port 5001):

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/onyx-houseware
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Increase max body size for file uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/onyx-houseware /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Now visit `http://YOUR_STATIC_IP` - your app should work on port 80!

### Step 11: Setup SSL/HTTPS (Recommended)

**Only if you have a domain name:**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (recommended)

# Certbot auto-configures Nginx for HTTPS!
```

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

Your app is now accessible at `https://yourdomain.com`!

---

## Post-Deployment Configuration

### 1. Update Session Cookie Settings

**✅ Already Configured:** The application is already configured for production HTTPS:

- **Trust Proxy**: Automatically enabled in production for Nginx reverse proxy
- **Secure Cookies**: Enabled when `NODE_ENV=production`
- **Session Security**: HTTP-only cookies with 24-hour expiration

The code already includes:

```typescript
// Trust proxy when behind reverse proxy (Nginx) in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Automatically secure in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);
```

**No additional configuration needed!** Just ensure `NODE_ENV=production` in your `.env` file.

To verify after deployment:

```bash
# Check that cookies are marked Secure in browser DevTools
# Network tab → Cookies → Should see "Secure" flag
```

### 2. Setup Database Backups

Create a backup script:

```bash
# Create backup directory
mkdir -p /home/ubuntu/backups
# Note: Database file itself is stored in /var/app/data
# Backups are stored separately in /home/ubuntu/backups

# Create backup script
nano /home/ubuntu/backup-db.sh
```

Paste:

```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DB_PATH="/var/app/data/onyx.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/onyx_$TIMESTAMP.db"

# Create backup
cp "$DB_PATH" "$BACKUP_FILE"

# Keep only last 30 backups
ls -t $BACKUP_DIR/onyx_*.db | tail -n +31 | xargs -r rm

echo "Backup created: $BACKUP_FILE"
```

Make executable:

```bash
chmod +x /home/ubuntu/backup-db.sh
```

Schedule daily backups with cron:

```bash
crontab -e
# Add this line (runs daily at 2 AM):
0 2 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/backup.log 2>&1
```

### 3. Monitor Application

```bash
# View logs
pm2 logs onyx-houseware

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System resource monitoring
htop  # Install with: sudo apt install htop
```

### 4. Update Application

When you make changes:

```bash
# On server
cd /home/ubuntu/onyx-houseware

# Pull latest changes
git pull  # or upload via SCP/rsync

# Install new dependencies (if any)
npm install

# Rebuild
npm run build

# Restart
pm2 restart onyx-houseware
```

---

## Important Considerations

### SQLite in Production

**✅ Advantages:**

- No separate database server needed
- Simple deployment
- Perfect for single-server applications
- Low resource usage

**⚠️ Limitations:**

- Single-writer (not ideal for high-concurrency writes)
- File-based (backup the entire file)
- No built-in replication

**Best Practices:**

1. **Regular backups** (automated daily backups)
2. **WAL mode enabled** (already configured in code)
3. **File permissions**: Ensure proper permissions on `server/data/onyx.db`
   ```bash
   chmod 664 /var/app/data/onyx.db
   chown ubuntu:ubuntu /var/app/data/onyx.db
   ```

### Session Storage

**Current Setup**: Memory-based sessions (using `memorystore`)

**⚠️ Production Consideration:**

- Sessions reset when app restarts
- All users will need to login again after deployment updates

**Upgrade Option** (for future):
If you need persistent sessions, consider Redis or PostgreSQL session store.

### Security Checklist

- [ ] Changed default admin password
- [ ] Generated strong SESSION_SECRET
- [ ] Enabled HTTPS with Let's Encrypt
- [ ] Configured firewall (only ports 80, 443, 22)
- [ ] Removed port 5001 from public access (if using Nginx)
- [ ] Setup automated database backups
- [ ] Updated session cookie to `secure: true`
- [ ] Keep Node.js and packages updated

### Performance Optimization

1. **Enable Nginx gzip compression:**

   ```nginx
   # Add to /etc/nginx/nginx.conf in http block
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
   ```

2. **Monitor disk space:**

   ```bash
   df -h  # Check disk usage
   ```

3. **Rotate logs:**
   PM2 handles log rotation automatically, but monitor log sizes.

### Scaling Considerations

**When to scale:**

- Response times consistently > 500ms
- CPU usage > 80%
- Memory usage > 80%
- Disk space < 20%

**Scaling options:**

1. **Vertical**: Upgrade LightSail instance size
2. **Horizontal**: Add load balancer + multiple instances (requires PostgreSQL instead of SQLite)

---

## Quick Reference Commands

### Local Development

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm start            # Run production build
npm run db:push      # Apply schema changes to database
```

### Production Server

```bash
# Application
pm2 status                    # Check status
pm2 logs onyx-houseware      # View logs
pm2 restart onyx-houseware   # Restart app
pm2 monit                    # Monitor resources

# Nginx
sudo nginx -t                # Test config
sudo systemctl restart nginx # Restart Nginx
sudo systemctl status nginx  # Check status

# Database Backup
/home/ubuntu/backup-db.sh    # Manual backup

# System
htop                         # Monitor resources
df -h                        # Check disk space
sudo systemctl status pm2-ubuntu  # Check PM2 service
```

---

## Troubleshooting

### App won't start

```bash
# Check logs
pm2 logs onyx-houseware --lines 100

# Common issues:
# - Missing .env file
# - Wrong Node.js version
# - Port already in use
```

### Can't access via browser

```bash
# Check if app is running
pm2 status

# Check if Nginx is running
sudo systemctl status nginx

# Check firewall rules in LightSail console

# Test direct access to Node.js
curl http://localhost:5001
```

### Database errors

```bash
# Check file permissions
ls -l server/data/onyx.db

# Check disk space
df -h

# Restore from backup if corrupted
cp /home/ubuntu/backups/onyx_LATEST.db server/data/onyx.db
pm2 restart onyx-houseware
```

---

## Support & Updates

For questions or issues:

1. Check logs: `pm2 logs onyx-houseware`
2. Review Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables in `.env`
4. Ensure database has proper permissions

**Remember:** Always backup before making changes to production!

---

**Last Updated:** October 2025
**Application Version:** 1.0.0
**Compatible with:** Node.js 20.x, Ubuntu 24.04 LTS, AWS LightSail
