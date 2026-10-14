# Checks the Lightpanda 1.0.0 asset that the image build downloaded, before the build installs it.
# Usage: sh check-lightpanda-digest.sh <target architecture> <asset file>
# The digests are the Linux digests that docs/lightpanda-runtime.md records. Change them only together.
set -eu

architecture=$1
asset=$2
case "$architecture" in
  amd64) expected=aa5a4b8ed53d1e38b3c73f5b2647d0a84a82e6744557f45f9a9c85858aa031c3 ;;
  arm64) expected=69791924bcee43b13b224af4c845622c5fe66fdbc1b8143bfaa39ca8f85244f5 ;;
  *)
    printf 'Lightpanda 1.0.0 has no Linux asset for %s. The image supports linux/amd64 and linux/arm64.\n' "$architecture" >&2
    exit 1
    ;;
esac
actual=$(sha256sum "$asset" | awk '{print $1}')
if [ "$actual" != "$expected" ]; then
  printf 'Lightpanda SHA256 check failed for linux/%s: the asset has the digest %s, but docs/lightpanda-runtime.md records %s. The image build stops.\n' \
    "$architecture" "$actual" "$expected" >&2
  exit 1
fi
