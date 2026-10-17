# EasyList snapshot

EasyList by The EasyList authors (https://easylist.to/).

`hosted-ad-rules.txt` is an unchanged copy of the complete EasyList file
from https://easylist.to/easylist/easylist.txt. It includes the original
header, notices, network rules, and cosmetic rules. Thermus uses only the
cosmetic rules that its native cleaner supports.

- Upstream version: `202610152217`.
- Upstream last modified: `15 Oct 2026 22:17 UTC`.
- Upstream source revision: `5e35cb4f3e2ebe95c8e20f7ec54fd328299a442a`.
- Revision URL: https://github.com/easylist/easylist/commit/5e35cb4f3e2ebe95c8e20f7ec54fd328299a442a.
- Retrieved: `2026-10-15` UTC.
- Size: `2170206` bytes.
- SHA-256: `f94c74712aa8a31bbec68640ea7dba93bf3427bbd6bbff55b716e4cd14b16549`.
- Changes to the upstream file: none.

## License and attribution

The EasyList license page, https://easylist.to/pages/licence.html, allows
use under either GNU GPL version 3 or later, or Creative Commons
Attribution-ShareAlike 3.0 Unported or later. Thermus distributes this
unchanged snapshot under Creative Commons Attribution-ShareAlike 3.0
Unported: https://creativecommons.org/licenses/by-sa/3.0/.
The full license text is in `hosted-ad-rules.LICENSE.txt`, copied from
https://creativecommons.org/licenses/by-sa/3.0/legalcode.txt.

Keep this attribution, the source information, the full license, and the
upstream notices with copies of the snapshot. This attribution does not
imply endorsement by the EasyList authors. The EasyList license applies
to the list. It does not supply a license for Thermus source code.

## Update procedure

1. Download the complete file from the official distribution URL above
   into a temporary location. Do not download it during an image build
   or at server startup.
2. Check its version, date, source commit, and upstream license notice.
   Keep all upstream bytes unchanged. Check that the commit exists in
   the official source repository.
3. Replace `hosted-ad-rules.txt`. Update the version, date, revision,
   retrieval date, byte count, and SHA-256 in this file and the snapshot
   details in `docs/reference/ad-rules.md`. Update the license file if
   the selected terms change.
4. Run the hosted policy acceptance test and the hosted image gate.
   Check removed ad content, retained article content, and native
   cleaner startup. Review changes to supported rules and exceptions.
5. Review the change in a pull request and build a new image. Restart the
   server with the new image to load the new snapshot. There is no
   automatic refresh, including when the upstream `Expires` period ends.
