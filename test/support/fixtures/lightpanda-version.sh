#!/bin/sh
if [ "$#" -eq 1 ] && [ "$1" = version ]; then
  printf '1.0.0\n'
  exit 0
fi
exit 1
