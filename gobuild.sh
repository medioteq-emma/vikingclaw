#!/bin/bash
export PATH=/usr/local/go/bin:$PATH
export GOPATH=/root/go
export GOCACHE=/tmp/go-cache

cd /mnt/c/VikingClaw

echo "=== Go version ==="
go version

echo ""
echo "=== go mod tidy ==="
go mod tidy 2>&1
echo "tidy exit: $?"

echo ""
echo "=== go build ./... ==="
go build ./... 2>&1
BUILD_EXIT=$?
echo "build_all exit: $BUILD_EXIT"

if [ $BUILD_EXIT -eq 0 ]; then
  echo ""
  echo "=== go build binary ==="
  go build -o vikingclaw . 2>&1
  echo "binary exit: $?"
fi

echo "=== DONE ==="
