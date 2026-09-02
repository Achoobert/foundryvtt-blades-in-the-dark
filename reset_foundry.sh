#!/bin/bash
set -e

CONTAINER_DIR="/Users/achoobert/repos/foundry_stuff/container_local_testing"
REPO_DIR="/Users/achoobert/repos/foundry_stuff/forged/blades68"
WORLD="blades68"

cd "$CONTAINER_DIR"
docker compose down -v
rm -rf "/Users/achoobert/foundrydata/Data/systems/blades68"
cd "$REPO_DIR"
npm run watch 
npm run test:quench:sync
npm run dev
sleep 20
cd "$CONTAINER_DIR"
./start_direct.sh "$WORLD"
