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
```

### 2. Run Locally
```bash
# Development mode (with hot reload)
npm run dev

# Access at http://localhost:5000
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
- Domain name (optional)

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
# PORT=5000
# NODE_ENV=production
```

**3. Build and run:**
```bash
npm run build

# Install PM2
sudo npm install -g pm2
pm2 start npm --name "onyx-houseware" -- start
pm2 startup systemd
pm2 save
```

**4. Setup Nginx:**
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

### Modify Schema
1. Edit `shared/schema.ts`
2. Update `server/storage.ts` (if needed)
3. Update `server/db/bootstrap.ts` (for new tables)

### Apply Changes
```bash
# Always backup first!
cp server/data/onyx.db server/data/onyx.db.backup

# Push schema changes
npm run db:push

# If you get warnings about data loss:
npm run db:push -- --force
```

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
cp server/data/onyx.db backups/onyx-$(date +%Y%m%d).db

# Restore backup
cp backups/onyx-20250116.db server/data/onyx.db
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
ls -l server/data/onyx.db  # Check permissions
df -h                       # Check disk space
```

---

## Full Documentation
See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide with detailed explanations.

---

**Need Help?**
- Check `pm2 logs onyx-houseware`
- Review `/var/log/nginx/error.log`
- Verify `.env` configuration
