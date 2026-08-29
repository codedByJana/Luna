#!/bin/bash
# Start script for Luna CTF Bot on Ubuntu LTS / DigitalOcean
# This script sets up environment and starts the bot with PM2 for process management

cd /home/jana8/Documents/Luna

# Check if .env exists, if not create a basic one
if [ ! -f .env ]; then
  echo "Creating .env file from defaults..."
  cat > .env << ENVEOF
TOKEN=your_discord_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
MONGODB_URI=mongodb://127.0.0.1:27017/Luna
ENVEOF
  echo "Please edit .env with your actual credentials before starting."
  exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo "Node.js is not installed. Please install it first."
  exit 1
fi

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
  echo "Warning: MongoDB is not running. Starting MongoDB..."
  mongod --fork --logpath /var/log/mongod.log --dbpath /var/lib/mongodb 2>/dev/null || \
  sudo mongod --fork --logpath /var/log/mongod.log --dbpath /var/lib/mongodb 2>/dev/null || \
  echo "Could not start MongoDB automatically. Please start it manually."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the bot using PM2 if available, otherwise directly
if command -v pm2 &> /dev/null; then
  echo "Starting bot with PM2..."
  pm2 start Luna.js --name "luna-ctf-bot" -- env NODE_ENV=production
  pm2 save
  pm2 startup systemd -u jana8 --hp /home/jana8
else
  echo "Starting bot directly..."
  node Luna.js &
  echo "Bot PID: $!"
fi

echo "To check logs: pm2 logs luna-ctf-bot"
echo "To restart: pm2 restart luna-ctf-bot"
echo "To stop: pm2 stop luna-ctf-bot"