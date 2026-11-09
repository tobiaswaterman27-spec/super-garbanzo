#!/bin/sh
# Runs every browser test against dist/outlaw.html (build it first). Prints each test's last lines;
# any line with "error" other than "no errors" is a failure.
cd "$(dirname "$0")"
fail=0
for t in smoke soak esc mail speech animals craft gang town decor life trade deep spoken fight gangs2 homefront scenes indoor approach streetfight march gangpol night archers raid kids adults idle cutpurse shakedown shopfront warsights marks passings lamps spar kidchores procession market roadfolk critters smuggle mishaps shopfront2 nightlife seasonsfx gentryride gangrites hunters courting2 infirm pastures alms bells boats storm escort tracks shopdisplay gravedigger daylabour bailey harbour haunt countryside stocks winterplay summermills lambs lordshunt rounds housecalls gangboss repairs wildfolk ferry riverbank treework sitework doorstep roomlife stableyard abbeylife winterwork streetcallers seasonchores livestock babes dawndusk puddles quayside cottageyards windy streetmuck hitching kidsplay2 straydog tollbar nightwalkers bakehouse workfx toothpull gentryleisure waterfowl rainfolk jostle gravevisits handcarts doorcheck hawking swallows mice; do
  out=$(timeout 300 node "$t.mjs" 2>&1 | grep -v ERR_CERT)
  echo "== $t"; echo "$out" | tail -4
  echo "$out" | grep -i "error\|exception" | grep -qv "^no errors" && fail=1
done
exit $fail
