#!/bin/sh
# Runs every browser test against dist/outlaw.html (build it first). Prints each test's last lines;
# any line with "error" other than "no errors" is a failure.
cd "$(dirname "$0")"
fail=0
for t in smoke soak esc mail speech animals craft gang town decor life trade deep; do
  out=$(timeout 300 node "$t.mjs" 2>&1 | grep -v ERR_CERT)
  echo "== $t"; echo "$out" | tail -4
  echo "$out" | grep -i "error\|exception" | grep -qv "^no errors" && fail=1
done
exit $fail
