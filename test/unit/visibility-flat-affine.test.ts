import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.ts';

describe('flat affine descendant restoration', () => {
  for (const { name, parent, child, parentHidden, childVisible, intermediate = false } of [
    { name: 'a composed near-zero scale', parent: 'scale(.05) scale(.05)', child: 'scale(400)',
      parentHidden: true, childVisible: true },
    { name: 'a near-zero scale', parent: 'scale(.001)', child: 'scale(1000)',
      parentHidden: true, childVisible: true },
    { name: 'a near-zero scale without an inverse', parent: 'scale(.001)', child: 'none',
      parentHidden: true, childVisible: false },
    { name: 'an untransformed intermediate wrapper', parent: 'scale(.001)', child: 'scale(1000)',
      parentHidden: true, childVisible: true, intermediate: true },
    { name: 'a large parent scale', parent: 'scale(1000)', child: 'scale(.001)',
      parentHidden: false, childVisible: true },
    { name: 'two flat 45 degree rotations', parent: 'rotateX(45deg)', child: 'rotateX(45deg)',
      parentHidden: false, childVisible: true },
    { name: 'a flat edge-on rotation', parent: 'rotateX(90deg)', child: 'rotateX(-90deg)',
      parentHidden: true, childVisible: false },
    { name: 'a near-edge-on invertible rotation', parent: 'rotateX(89.9deg)', child: 'scaleY(1000)',
      parentHidden: true, childVisible: true },
  ]) {
    test(`${childVisible ? 'keeps' : 'removes'} a child under ${name}`, async () => {
      const result = await cleanBody(
        `<div style="transform:${parent};transform-origin:0 0 0">` +
        (parentHidden ? 'Hidden parent' : 'Visible parent') +
        (intermediate ? '<div>Hidden wrapper' : '') +
        `<p style="transform:${child};transform-origin:0 0 0">Target child</p>` +
        (intermediate ? '</div>' : '') + '</div>',
      );

      assert.doesNotMatch(result.html, /Hidden parent|Hidden wrapper/);
      if (!parentHidden) assert.match(result.html, /Visible parent/);
      if (childVisible) assert.match(result.html, /Target child/);
      else assert.doesNotMatch(result.html, /Target child/);
      assert.equal(result.markdown,
        (!parentHidden ? 'Visible parent\n\n' : '') +
        (childVisible ? 'Target child\n\n' : '') + 'Visible sibling');
      assert.deepEqual(result.found, parentHidden || !childVisible ? ['hidden-html'] : []);
    });
  }
});
