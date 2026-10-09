import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

const visibilityCases = [
  {
    name: 'keeps a visible override after its hidden predecessor is removed',
    html: '<style>.payload{display:none}.before+.payload{display:block}</style><main>'
      + '<i hidden class="before">HIDDEN PREDECESSOR</i>'
      + '<p class="payload">VISIBLE TARGET</p><p>OTHER CONTROL</p></main>',
    hidden: 'HIDDEN PREDECESSOR',
    visible: 'VISIBLE TARGET',
  },
  {
    name: 'keeps a visible target when a removal creates a hiding sibling match',
    html: '<style>.before+.payload{display:none}</style><main>'
      + '<i class="before">VISIBLE PREDECESSOR</i><i hidden>HIDDEN GAP</i>'
      + '<p class="payload">VISIBLE TARGET</p><p>OTHER CONTROL</p></main>',
    hidden: 'HIDDEN GAP',
    visible: 'VISIBLE TARGET',
  },
  {
    name: 'keeps a visible reconstructed copy after a sibling is removed',
    html: '<style>.x{display:none}.before+p .x{display:block}</style><main>'
      + '<p><b class="x" data-control="kept">HIDDEN FIRST COPY'
      + '<p hidden class="before">HIDDEN SECOND COPY'
      + '<p>VISIBLE COPY</b></p><p>OTHER CONTROL</p></main>',
    hidden: 'HIDDEN FIRST COPY|HIDDEN SECOND COPY',
    visible: 'VISIBLE COPY',
  },
  {
    name: 'keeps an implied table body after a hidden caption is removed',
    html: '<style>tbody{display:none}caption+tbody{display:table-row-group}</style><main>'
      + '<table><caption hidden>HIDDEN CAPTION</caption>'
      + '<tr hidden><td>HIDDEN FIRST ROW</td></tr><tr><td>VISIBLE CELL</td></tr></table>'
      + '<p>OTHER CONTROL</p></main>',
    hidden: 'HIDDEN CAPTION|HIDDEN FIRST ROW',
    visible: 'VISIBLE CELL',
  },
  {
    name: 'removes a new hidden child inside a retained visible target',
    html: '<style>.payload{display:none}.before+.payload{display:block}.new{display:none}</style>'
      + '<main><i hidden class="before">HIDDEN PREDECESSOR</i><p class="payload">VISIBLE TARGET '
      + '<<span hidden>HIDDEN CUT</span>em class="new">HIDDEN NEW CHILD</em></p>'
      + '<p>OTHER CONTROL</p></main>',
    hidden: 'HIDDEN PREDECESSOR|HIDDEN CUT|HIDDEN NEW CHILD',
    visible: 'VISIBLE TARGET',
  },
  {
    name: 'removes retained descendants under a new hidden ancestor',
    html: '<style>.payload{display:none}</style><main>'
      + '<<span hidden>HIDDEN CUT</span>section class="payload">'
      + '<p>HIDDEN DESCENDANT</p></section><p>VISIBLE TARGET</p><p>OTHER CONTROL</p></main>',
    hidden: 'HIDDEN CUT|HIDDEN DESCENDANT',
    visible: 'VISIBLE TARGET',
  },
  {
    name: 'uses a formed stylesheet only for newly formed targets',
    html: '<main><<span hidden>HIDDEN STYLE CUT</span>style>.payload{display:none}</style>'
      + '<p class="payload">VISIBLE OLD TARGET</p>'
      + '<<span hidden>HIDDEN TAG CUT</span>p class="payload">HIDDEN NEW TARGET</p>'
      + '<p>OTHER CONTROL</p></main>',
    hidden: 'HIDDEN STYLE CUT|HIDDEN TAG CUT|HIDDEN NEW TARGET',
    visible: 'VISIBLE OLD TARGET',
  },
  {
    name: 'checks implied wrappers below a newly formed source parent',
    html: '<style>tbody{display:none}.old>tbody{display:table-row-group}</style><main>'
      + '<<span hidden>HIDDEN CUT</span>table><tr><td>'
      + '<table class="old"><tr><td>HIDDEN RETAINED CELL</td></tr></table>'
      + '</td></tr></table><p>VISIBLE TARGET</p><p>OTHER CONTROL</p></main>',
    hidden: 'HIDDEN CUT|HIDDEN RETAINED CELL',
    visible: 'VISIBLE TARGET',
  },
];

describe('CSS visibility for retained source nodes', () => {
  for (const { name, html, hidden, visible } of visibilityCases) {
    test(name, async () => {
      const result = await createPipeline().process('https://example.com/retained-css', html);

      assert.doesNotMatch(result.html, new RegExp(hidden));
      assert.doesNotMatch(result.markdown ?? '', new RegExp(hidden));
      assert.ok(result.html.includes(visible));
      assert.ok(result.markdown?.includes(visible));
      assert.match(result.html, /OTHER CONTROL/);
      assert.match(result.markdown ?? '', /OTHER CONTROL/);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 1);
      assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
    });
  }

  test('resets retained visibility for each pipeline invocation', async () => {
    const pipeline = createPipeline();
    const body = '<main><i hidden>HIDDEN CUT</i><p class="payload">TARGET CONTENT</p>'
      + '<p>OTHER CONTROL</p></main>';

    const visible = await pipeline.process(
      'https://example.com/first-css', `<style>.payload{display:block}</style>${body}`,
    );
    const hidden = await pipeline.process(
      'https://example.com/second-css', `<style>.payload{display:none }</style>${body}`,
    );

    assert.match(visible.html, /TARGET CONTENT/);
    assert.match(visible.markdown ?? '', /TARGET CONTENT/);
    assert.doesNotMatch(hidden.html, /TARGET CONTENT|HIDDEN CUT/);
    assert.doesNotMatch(hidden.markdown ?? '', /TARGET CONTENT|HIDDEN CUT/);
    for (const result of [visible, hidden]) {
      assert.match(result.html, /OTHER CONTROL/);
      assert.match(result.markdown ?? '', /OTHER CONTROL/);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 1);
    }
  });

  test('keeps direct text in a retained implied body', async () => {
    // The prefix creates the body before the parser sees its source start tag.
    const html = '<<span hidden>HIDDEN CUT</span>style>body{display:none}</style>'
      + 'Body prefix<body>VISIBLE DIRECT TEXT</body>';

    const result = await createPipeline().process('https://example.com/retained-body', html);

    assert.match(result.html, /VISIBLE DIRECT TEXT/);
    assert.match(result.markdown ?? '', /VISIBLE DIRECT TEXT/);
    assert.doesNotMatch(result.html, /HIDDEN CUT/);
    assert.doesNotMatch(result.markdown ?? '', /HIDDEN CUT/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 1);
  });

  test('checks attributes merged into an implied body by a new start tag', async () => {
    const html = '<style>.payload{display:none}</style><main><p>HIDDEN ORIGINAL</p>'
      + '<<span hidden>HIDDEN CUT</span>body class="payload"><p>HIDDEN LATER</p></main>';

    const result = await createPipeline().process('https://example.com/formed-body', html);

    assert.doesNotMatch(result.html, /HIDDEN ORIGINAL|HIDDEN CUT|HIDDEN LATER/);
    assert.equal(result.markdown, '');
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 1);
    assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
  });

  for (const tag of ['html', 'body']) {
    test(`checks attributes merged into an explicit ${tag} by a new start tag`, async () => {
      const html = `<${tag}><style>.payload{display:none}</style><main><p>HIDDEN ORIGINAL</p>`
        + `<<span hidden>HIDDEN CUT</span>${tag} class="payload"><p>HIDDEN LATER</p></main></${tag}>`;

      const result = await createPipeline().process('https://example.com/merged-document', html);

      assert.doesNotMatch(result.html, /HIDDEN ORIGINAL|HIDDEN CUT|HIDDEN LATER/);
      assert.equal(result.markdown, '');
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 1);
      assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
    });
  }
});
