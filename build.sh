#!/bin/bash
export PATH=$PATH:/usr/local/go/bin
cd /mnt/c/VikingClaw
echo "=== go build ./... ==="
go build ./... 2>&1
echo "BUILD_ALL_EXIT:$?"
echo "=== go build binary ==="
go build -o vikingclaw . 2>&1
echo "BUILD_BIN_EXIT:$?"
