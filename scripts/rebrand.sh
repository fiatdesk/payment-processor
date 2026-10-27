#!/usr/bin/env bash
# Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
#
# Rebrands the repository in one pass.
#
#   bash scripts/rebrand.sh [--dry-run] <name> <Name> <infix>
#
#   <name>   lowercase identifier: package scope @<name>, CLI bin <name>,
#            connected-account header <name>-account, env prefix <NAME>_
#   <Name>   display name: the same word with its capitals (e.g. FiatDesk)
#   <infix>  object id infix: po_<infix>_..., sk_live_<infix>_...
#
# The current tokens are read from BRAND in libs/shared-types/src/lib/Brand.ts,
# so a second run with the same arguments changes nothing, and a later run can
# rebrand again. --dry-run prints the hit count of each pattern and writes
# nothing.
#
# Only tracked text files under SCOPE are rewritten. Never touched: LICENSE,
# NOTICE, CHANGES.md, docs/plans/, the root package-lock.json (npm install
# regenerates it), contracts/lib/, Solidity sources (a renamed EIP-712 domain
# would change signed digests; the script warns instead), and this script and
# its self-test.
#
# Kept everywhere: the per-file attribution header line, upstream attribution
# (github.com/zonelessdev links, "Zoneless Ltd", "fork of the Zoneless
# project"), Angular's own "zoneless" APIs, the HKDF salt, and references to
# binary assets named after the old brand (replace those assets by hand).
set -euo pipefail

usage() {
  echo "usage: bash scripts/rebrand.sh [--dry-run] <name> <Name> <infix>" >&2
  echo "  e.g. bash scripts/rebrand.sh --dry-run acme Acme a" >&2
  exit 2
}

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
  shift
fi
[ "$#" -eq 3 ] || usage

NAME_LOWER=$1
NAME_DISPLAY=$2
INFIX=$3

if ! printf '%s' "$NAME_LOWER" | grep -Eq '^[a-z][a-z0-9]*$'; then
  echo "rebrand: <name> must match ^[a-z][a-z0-9]*\$ (it is used in identifiers)" >&2
  exit 2
fi
if ! printf '%s' "$NAME_DISPLAY" | grep -Eq '^[A-Z][A-Za-z0-9]*$'; then
  echo "rebrand: <Name> must match ^[A-Z][A-Za-z0-9]*\$" >&2
  exit 2
fi
if [ "$(printf '%s' "$NAME_DISPLAY" | tr '[:upper:]' '[:lower:]')" != "$NAME_LOWER" ]; then
  echo "rebrand: <Name> must be <name> with capitals (got $NAME_DISPLAY for $NAME_LOWER)" >&2
  exit 2
fi
if ! printf '%s' "$INFIX" | grep -Eq '^[a-z0-9]+$'; then
  echo "rebrand: <infix> must match ^[a-z0-9]+\$" >&2
  exit 2
fi

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "rebrand: $ROOT is not a git work tree" >&2
  exit 2
}

BRAND_FILE=libs/shared-types/src/lib/Brand.ts
[ -f "$BRAND_FILE" ] || {
  echo "rebrand: $BRAND_FILE not found" >&2
  exit 2
}

SCOPE=(
  apps libs sdks docker docker-compose.yml '.env*.example'
  README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md AGENTS.md
  .github .agents scripts contracts package.json 'tsconfig*.json'
)
EXCLUDE=(
  ':(exclude)LICENSE' ':(exclude)NOTICE' ':(exclude)CHANGES.md'
  ':(exclude)docs/plans' ':(exclude)package-lock.json'
  ':(exclude)contracts/lib' ':(exclude,glob)contracts/**/*.sol'
  ':(exclude)scripts/rebrand.sh' ':(exclude)scripts/rebrand.spec.sh'
)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

git ls-files -z -- "${SCOPE[@]}" "${EXCLUDE[@]}" >"$TMP/all"
git grep -I -l -z -e '' -- "${SCOPE[@]}" "${EXCLUDE[@]}" >"$TMP/text" || true
git ls-files -z -- 'contracts/*.sol' ':(exclude)contracts/lib' >"$TMP/sol"

RB_DRY_RUN=$DRY_RUN RB_NAME=$NAME_LOWER RB_DISPLAY=$NAME_DISPLAY \
  RB_INFIX=$INFIX RB_BRAND_FILE=$BRAND_FILE RB_TMP=$TMP \
  perl -e '
use strict;
use warnings;

my $dry   = $ENV{RB_DRY_RUN};
my $name  = $ENV{RB_NAME};
my $Name  = $ENV{RB_DISPLAY};
my $infix = $ENV{RB_INFIX};
my $NAME  = uc $name;
my $brand_file = $ENV{RB_BRAND_FILE};
my $tmp   = $ENV{RB_TMP};

sub Slurp { my ($p) = @_; open(my $fh, "<:raw", $p) or die "rebrand: cannot read $p: $!\n"; local $/; my $c = <$fh>; close $fh; return defined $c ? $c : ""; }
sub Spit  { my ($p, $c) = @_; open(my $fh, ">:raw", $p) or die "rebrand: cannot write $p: $!\n"; print $fh $c; close $fh; }
sub List  { my ($p) = @_; my $c = Slurp($p); return grep { length } split /\0/, $c; }

# 1. Current tokens, from BRAND.
my $brand = Slurp($brand_file);
my %old;
for my $key (qw(productName packageScope idInfix connectedAccountHeader envPrefix cliBin)) {
  $brand =~ /^\s*\Q$key\E:\s*\x27([^\x27]*)\x27,?\s*$/m
    or die "rebrand: cannot read BRAND.$key from $brand_file\n";
  $old{$key} = $1;
}
my %new = (
  productName => $Name, packageScope => "\@$name", idInfix => $infix,
  connectedAccountHeader => "$name-account", envPrefix => $NAME, cliBin => $name,
);

# Upstream text that keeps its name.
my $HEADER = qr{^\s*(?://|\#)\s*Modified from the Zoneless project \(Apache-2\.0\)\. See NOTICE and CHANGES\.md\.\s*$};
my @keep = (
  qr{github\.com/zonelessdev/[\w./-]*},       # upstream repository links
  qr{Zoneless Ltd\.?},                         # upstream copyright holder
  qr{fork of the Zoneless project},            # README attribution
  qr{provideZonelessChangeDetection},          # Angular API
  qr{setupZonelessTestEnv},                    # jest-preset-angular API
  qr{jest-preset-angular/setup-env/zoneless},  # jest-preset-angular entry point
  qr{zoneless-v1},                             # HKDF salt: renaming it changes every derived key
);

# 2-4. Patterns, most specific first. Each one sees only text that no earlier
# pattern replaced.
my @rules;
sub Rule { my ($label, $re, $rep) = @_; push @rules, { label => $label, re => $re, rep => $rep, hits => 0, files => 0 }; }
my ($oN, $oS, $oI, $oH, $oE, $oB) = @old{qw(productName packageScope idInfix connectedAccountHeader envPrefix cliBin)};
Rule("$oS/ -> \@$name/ (package scope)", qr{\Q$oS\E(?=\\?/)}, "\@$name") if $oS ne "\@$name";
Rule("$oH -> $name-account (header)", qr{\Q$oH\E}, "$name-account") if $oH ne "$name-account";
if ($oN ne $Name) {
  Rule("$oN-Account -> $Name-Account (header)", qr{\Q$oN\E(?=-Account\b)}, $Name);
  Rule("$oN-Signature -> $Name-Signature (webhook header)", qr{\Q$oN\E(?=-Signature\b)}, $Name);
  Rule("${oN}PayoutBatchError -> ${Name}PayoutBatchError (SDK)", qr{\Q$oN\E(?=PayoutBatchError\b)}, $Name);
}
Rule("$oB-signature -> $name-signature (webhook header)", qr{\Q$oB\E(?=-signature\b)}, $name) if $oB ne $name;
if ($oE ne $NAME) {
  Rule("${oE}_ -> ${NAME}_ (env prefix)", qr{\Q$oE\E(?=_)}, $NAME);
  Rule("$oE -> $NAME", qr{\Q$oE\E}, $NAME);
}
Rule("$oN -> $Name", qr{\Q$oN\E}, $Name) if $oN ne $Name;
Rule("$oB -> $name", qr{\Q$oB\E}, $name) if $oB ne $name;
Rule("_$oI -> _$infix (id infix)", qr{(?<=[a-z])_\Q$oI\E(?![A-Za-z0-9])}, "_$infix") if $oI ne $infix;

# Paths: rename text files named after the old brand; keep binary assets and
# every reference to them.
my %is_text = map { $_ => 1 } List("$tmp/text");
my (@renames, @binary_kept);
for my $path (List("$tmp/all")) {
  next if $oB eq $name || $path !~ /\Q$oB\E/;
  if ($is_text{$path}) {
    (my $to = $path) =~ s/\Q$oB\E/$name/g;
    push @renames, [$path, $to];
  } else {
    push @binary_kept, $path;
    (my $base = $path) =~ s{.*/}{};
    push @keep, qr{\Q$base\E};
  }
}
my $KEEP = join "|", @keep;

my ($header_kept, $upstream_kept, $changed_files) = (0, 0, 0);
my %write;
for my $path (sort keys %is_text) {
  next if $path eq $brand_file;
  my $content = Slurp($path);
  my @hit_in_file = (0) x @rules;
  my $out = "";
  for my $line (split /(?<=\n)/, $content) {
    if ($line =~ $HEADER) { $header_kept++; $out .= $line; next; }
    my @saved;
    $line =~ s/($KEEP)/push(@saved, $1); "\x02" . $#saved . "\x02"/ge;
    $upstream_kept += @saved;
    for my $i (0 .. $#rules) {
      my $n = ($line =~ s/$rules[$i]{re}/\x01$i\x01/g);
      $hit_in_file[$i] += $n || 0;
    }
    $line =~ s/\x01(\d+)\x01/$rules[$1]{rep}/g;
    $line =~ s/\x02(\d+)\x02/$saved[$1]/g;
    $out .= $line;
  }
  for my $i (0 .. $#rules) {
    next unless $hit_in_file[$i];
    $rules[$i]{hits} += $hit_in_file[$i];
    $rules[$i]{files}++;
  }
  if ($out ne $content) { $changed_files++; $write{$path} = $out; }
}

# 1. BRAND itself.
my $brand_out = $brand;
my $brand_hits = 0;
for my $key (sort keys %new) {
  next if $old{$key} eq $new{$key};
  $brand_out =~ s/^(\s*\Q$key\E:\s*)\x27[^\x27]*\x27/$1\x27$new{$key}\x27/m and $brand_hits++;
}
$write{$brand_file} = $brand_out if $brand_out ne $brand;

# Solidity is never rewritten; say where the old brand appears.
my @sol_hits;
for my $path (List("$tmp/sol")) {
  my $n = 1;
  for my $line (split /(?<=\n)/, Slurp($path)) {
    push @sol_hits, "$path:$n" if $line !~ $HEADER && $line =~ /\Q$oB\E|\Q$oN\E|\Q$oE\E/i;
    $n++;
  }
}

printf "rebrand: %s -> %s (name %s -> %s, id infix %s -> %s)%s\n",
  $oN, $Name, $oB, $name, $oI, $infix, $dry ? " [dry run]" : "";
my $fmt = "  %-58s %6s %6s\n";
printf $fmt, "pattern", "hits", "files";
printf $fmt, "BRAND fields ($brand_file)", $brand_hits, $brand_hits ? 1 : 0;
printf $fmt, $_->{label}, $_->{hits}, $_->{files} for @rules;
printf $fmt, "renamed paths", scalar(@renames), scalar(@renames);
printf "  kept: %d attribution header lines, %d upstream references\n", $header_kept, $upstream_kept;
printf "  files to write: %d\n", $changed_files + ($write{$brand_file} ? 1 : 0);
print "  rename: $_->[0] -> $_->[1]\n" for @renames;
print "  kept binary asset (replace it by hand): $_\n" for @binary_kept;
if (@sol_hits) {
  print "  WARNING: Solidity mentions the old brand; it is not rewritten (EIP-712 domains change signed digests):\n";
  print "    $_\n" for @sol_hits;
}

if ($dry) { print "dry run: no files written\n"; exit 0; }

Spit($_, $write{$_}) for sort keys %write;
for my $r (@renames) {
  my ($from, $to) = @$r;
  (my $dir = $to) =~ s{/[^/]*$}{};
  system("mkdir", "-p", $dir) == 0 or die "rebrand: mkdir $dir failed\n" if $dir ne $to;
  system("git", "mv", "--", $from, $to) == 0 or die "rebrand: git mv $from failed\n";
  (my $old_dir = $from) =~ s{/[^/]*$}{};
  while ($old_dir ne $from && -d $old_dir && rmdir $old_dir) { last if $old_dir !~ s{/[^/]*$}{}; }
}
'

if [ "$DRY_RUN" -eq 0 ]; then
  cat <<'EOF'
Next steps:
  npm install                               # refresh package-lock.json for the new scope
  npx nx run-many --target=test --all
  npm run format
  git status && git diff --stat             # review every change before committing
EOF
fi
