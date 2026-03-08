#!/bin/bash
export PATH=$PATH:/usr/local/go/bin
cd /mnt/c/VikingClaw
go build ./... > /tmp/vk_build.txt 2>&1
echo "EXIT:$?" >> /tmp/vk_build.txt
cat /tmp/vk_build.txt
