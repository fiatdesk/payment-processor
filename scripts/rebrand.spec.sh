#!/usr/bin/env bash
# Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
#
# Self-test for scripts/rebrand.sh. Builds a small fixture repository in a temp
# directory, runs the script there (dry run, real run, second run) and checks
# the counts and the rewritten files. Prints "rebrand.spec.sh: OK" on success.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
REPO=$WORK/repo
HEADER='// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.'

Fail() {
  echo "rebrand.spec.sh: FAIL: $*" >&2
  exit 1
}

# Prints "<hits> <files>" for a row of the script's table.
Row() {
  perl -ne 'BEGIN { $label = shift @ARGV }
    if (/^  \Q$label\E\s+(\d+)\s+(\d+)\s*$/) { print "$1 $2\n"; exit }' "$2" "$1"
}

ExpectRow() {
  local got
  got=$(Row "$1" "$2")
  [ "$got" = "$3" ] || Fail "row '$2' in $(basename "$1"): expected '$3', got '${got:-missing}'"
}

ExpectSame() {
  diff -u "$2" "$1" >/dev/null || {
    diff -u "$2" "$1" >&2 || true
    Fail "$1 differs from the expected content"
  }
}

mkdir -p "$REPO"
cd "$REPO"
mkdir -p scripts libs/shared-types/src/lib apps/api/src apps/web/assets \
  .agents/skills/zoneless-payments contracts/src contracts/lib/dep docs/plans
cp "$HERE/rebrand.sh" scripts/rebrand.sh

cat >libs/shared-types/src/lib/Brand.ts <<EOF
$HEADER
export const BRAND = {
  productName: 'Zoneless',
  packageScope: '@zoneless',
  idInfix: 'z',
  connectedAccountHeader: 'zoneless-account',
  envPrefix: 'ZONELESS',
  cliBin: 'zoneless',
} as const;
EOF

cat >apps/api/src/sample.ts <<'EOF'
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { BRAND } from '@zoneless/shared-types';
const re = /from '@zoneless\/shared-schemas'/;
headers['Zoneless-Signature'] = sig;
const sig = req.headers['zoneless-signature'];
headers['zoneless-account'] = 'acct_z_1Nv0FGQ9RKHgCVdK';
// Pass the Zoneless-Account header
throw new ZonelessPayoutBatchError(); // ZonelessApiError
const key = process.env.ZONELESS_API_KEY; // 'ZONELESS'
const zoneless = new Zoneless('sk_live_z_KEY'); // zonelessAccount
expect(id).toMatch(/^po_z_[0-9A-Za-z]{16}$/); // vs_z... 'pi_z' `wa_z_${i}`
const HKDF_SALT = 'zoneless-v1';
provideZonelessChangeDetection(); setupZonelessTestEnv();
import 'jest-preset-angular/setup-env/zoneless';
const notAnInfix = 'xyz_zebra' + 'A_z_1' + 'p_z1';
EOF

cat >README.md <<'EOF'
# Zoneless
This is an independent fork of the Zoneless project (Apache-2.0): https://github.com/zonelessdev/zoneless, Copyright 2026 Zoneless Ltd.
Zoneless ships the `zoneless` CLI.
EOF

printf '# Zoneless config\nZONELESS_API_URL=http://localhost\n' >.env.example
printf 'Zoneless contracts.\n' >contracts/README.md
printf '%s\npragma solidity 0.8.28;\ncontract A { constructor() EIP712("Zoneless", "1") {} }\n' "$HEADER" >contracts/src/A.sol
printf 'Zoneless dependency.\n' >contracts/lib/dep/README.md
printf -- '---\nname: zoneless-payments\n---\nUse Zoneless.\n' >.agents/skills/zoneless-payments/SKILL.md
printf '#!/bin/bash\n# Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.\npkill zoneless\n' >scripts/kill.sh
printf '{ "name": "@zoneless/source", "bin": { "zoneless": "main.js" } }\n' >package.json
printf '{ "paths": { "@zoneless/node": ["sdks/node/src/index.ts"] } }\n' >tsconfig.base.json
printf '<img src="assets/zoneless-logo.png" alt="Zoneless" />\n' >apps/web/page.html
printf 'PNG\0\0\0zoneless' >apps/web/assets/zoneless-logo.png
for keep in LICENSE NOTICE CHANGES.md docs/plans/plan.md; do
  printf 'Copyright 2026 Zoneless Ltd. Zoneless zoneless ZONELESS_X acct_z_1\n' >"$keep"
done
printf '{ "name": "@zoneless/source" }\n' >package-lock.json

git init -q
git add -A
git -c user.name=rebrand-spec -c user.email=rebrand-spec@example.com \
  -c commit.gpgsign=false commit -q -m fixture

# Arguments are validated.
if bash scripts/rebrand.sh --dry-run acme acme a >/dev/null 2>&1; then
  Fail "accepted a display name without capitals"
fi
if bash scripts/rebrand.sh --dry-run acme Acme >/dev/null 2>&1; then
  Fail "accepted two arguments"
fi

# Dry run: counts, and nothing written.
bash scripts/rebrand.sh --dry-run acme Acme a >"$WORK/dry.txt"
grep -qx 'dry run: no files written' "$WORK/dry.txt" || Fail "dry run did not say it wrote nothing"
[ -z "$(git status --porcelain)" ] || Fail "dry run changed the tree: $(git status --porcelain)"
ExpectRow "$WORK/dry.txt" 'BRAND fields (libs/shared-types/src/lib/Brand.ts)' '6 1'
ExpectRow "$WORK/dry.txt" '@zoneless/ -> @acme/ (package scope)' '4 3'
ExpectRow "$WORK/dry.txt" 'zoneless-account -> acme-account (header)' '1 1'
ExpectRow "$WORK/dry.txt" 'Zoneless-Account -> Acme-Account (header)' '1 1'
ExpectRow "$WORK/dry.txt" 'Zoneless-Signature -> Acme-Signature (webhook header)' '1 1'
ExpectRow "$WORK/dry.txt" 'ZonelessPayoutBatchError -> AcmePayoutBatchError (SDK)' '1 1'
ExpectRow "$WORK/dry.txt" 'zoneless-signature -> acme-signature (webhook header)' '1 1'
ExpectRow "$WORK/dry.txt" 'ZONELESS_ -> ACME_ (env prefix)' '2 2'
ExpectRow "$WORK/dry.txt" 'ZONELESS -> ACME' '1 1'
ExpectRow "$WORK/dry.txt" 'Zoneless -> Acme' '8 6'
ExpectRow "$WORK/dry.txt" 'zoneless -> acme' '6 5'
ExpectRow "$WORK/dry.txt" '_z -> _a (id infix)' '6 1'
ExpectRow "$WORK/dry.txt" 'renamed paths' '1 1'
grep -qx '  kept: 2 attribution header lines, 8 upstream references' "$WORK/dry.txt" ||
  Fail "unexpected kept counts: $(grep 'kept:' "$WORK/dry.txt")"
grep -qx '  files to write: 10' "$WORK/dry.txt" || Fail "unexpected file count: $(grep 'files to write' "$WORK/dry.txt")"
grep -qx '  kept binary asset (replace it by hand): apps/web/assets/zoneless-logo.png' "$WORK/dry.txt" ||
  Fail "binary asset not reported"
grep -qx '    contracts/src/A.sol:3' "$WORK/dry.txt" || Fail "Solidity mention not reported"

# Real run.
bash scripts/rebrand.sh acme Acme a >"$WORK/run.txt"
ExpectRow "$WORK/run.txt" 'Zoneless -> Acme' '8 6'
grep -q '^Next steps:' "$WORK/run.txt" || Fail "real run did not print the follow-ups"

cat >"$WORK/sample.expected" <<'EOF'
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { BRAND } from '@acme/shared-types';
const re = /from '@acme\/shared-schemas'/;
headers['Acme-Signature'] = sig;
const sig = req.headers['acme-signature'];
headers['acme-account'] = 'acct_a_1Nv0FGQ9RKHgCVdK';
// Pass the Acme-Account header
throw new AcmePayoutBatchError(); // AcmeApiError
const key = process.env.ACME_API_KEY; // 'ACME'
const acme = new Acme('sk_live_a_KEY'); // acmeAccount
expect(id).toMatch(/^po_a_[0-9A-Za-z]{16}$/); // vs_a... 'pi_a' `wa_a_${i}`
const HKDF_SALT = 'zoneless-v1';
provideZonelessChangeDetection(); setupZonelessTestEnv();
import 'jest-preset-angular/setup-env/zoneless';
const notAnInfix = 'xyz_zebra' + 'A_z_1' + 'p_z1';
EOF
ExpectSame apps/api/src/sample.ts "$WORK/sample.expected"
[ "$(head -n 1 apps/api/src/sample.ts)" = "$HEADER" ] || Fail "attribution header line changed"

cat >"$WORK/brand.expected" <<EOF
$HEADER
export const BRAND = {
  productName: 'Acme',
  packageScope: '@acme',
  idInfix: 'a',
  connectedAccountHeader: 'acme-account',
  envPrefix: 'ACME',
  cliBin: 'acme',
} as const;
EOF
ExpectSame libs/shared-types/src/lib/Brand.ts "$WORK/brand.expected"

cat >"$WORK/readme.expected" <<'EOF'
# Acme
This is an independent fork of the Zoneless project (Apache-2.0): https://github.com/zonelessdev/zoneless, Copyright 2026 Zoneless Ltd.
Acme ships the `acme` CLI.
EOF
ExpectSame README.md "$WORK/readme.expected"

printf '# Acme config\nACME_API_URL=http://localhost\n' >"$WORK/env.expected"
ExpectSame .env.example "$WORK/env.expected"
printf '#!/bin/bash\n# Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.\npkill acme\n' >"$WORK/kill.expected"
ExpectSame scripts/kill.sh "$WORK/kill.expected"
printf '{ "name": "@acme/source", "bin": { "acme": "main.js" } }\n' >"$WORK/package.expected"
ExpectSame package.json "$WORK/package.expected"
printf '<img src="assets/zoneless-logo.png" alt="Acme" />\n' >"$WORK/page.expected"
ExpectSame apps/web/page.html "$WORK/page.expected"
printf -- '---\nname: acme-payments\n---\nUse Acme.\n' >"$WORK/skill.expected"
ExpectSame .agents/skills/acme-payments/SKILL.md "$WORK/skill.expected"
[ ! -e .agents/skills/zoneless-payments ] || Fail "old skill directory still exists"

for untouched in LICENSE NOTICE CHANGES.md docs/plans/plan.md package-lock.json \
  contracts/src/A.sol contracts/lib/dep/README.md apps/web/assets/zoneless-logo.png \
  scripts/rebrand.sh; do
  git diff --quiet -- "$untouched" || Fail "$untouched was modified"
done

# A second run with the same arguments changes nothing.
git add -A
before=$(git write-tree)
bash scripts/rebrand.sh acme Acme a >"$WORK/again.txt"
git add -A
[ "$(git write-tree)" = "$before" ] || Fail "second run changed the tree"
grep -qx '  files to write: 0' "$WORK/again.txt" || Fail "second run planned writes"
ExpectRow "$WORK/again.txt" 'BRAND fields (libs/shared-types/src/lib/Brand.ts)' '0 0'
ExpectRow "$WORK/again.txt" 'renamed paths' '0 0'

echo "rebrand.spec.sh: OK"
