import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

async function cleanBody(body: string, head = '') {
  return createPipeline().process('https://example.com/',
    `<!doctype html><html><head>${head}</head><body><main>${body}` +
    '<p>Visible sibling</p></main></body></html>');
}

test('keeps a flat child whose inverse restores a near-singular parent', async () => {
  const result = await cleanBody(
    '<div style="transform:matrix(1,1,1,1.0000000000000018,0,0)">' +
    '<p style="transform:matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)">' +
    'Visible child</p></div>',
  );

  assert.match(result.html, /Visible child/);
  assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
  assert.deepEqual(result.found, []);
});

test('keeps a restored child when a long matrix coefficient exceeds the exact proof budget', async () => {
  const coefficient = `1.0000000000000018${'0'.repeat(130)}`;
  const result = await cleanBody(
    `<div style="transform:matrix(1,1,1,${coefficient},0,0)">` +
    '<p style="transform:matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)">' +
    'Visible child</p></div>',
  );

  assert.match(result.html, /Visible child/);
  assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
  assert.deepEqual(result.found, []);
});

describe('zero-font input values', () => {
  for (const type of [undefined, 'TEXT', 'invalid-type', 'search', 'tel', 'url', 'email', 'password']) {
    test(`removes the zero-font value from ${type ?? 'default'} input`, async () => {
      const attribute = type === undefined ? '' : ` type="${type}"`;
      const result = await cleanBody(`<input${attribute} style="font-size:0" value="Hidden payload">`);

      assert.doesNotMatch(result.html, /Hidden payload/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  test('removes an input value with a zero-font class', async () => {
    const result = await cleanBody(
      '<input type="text" class="zero" value="Hidden payload">',
      '<style>.zero{font-size:0}</style>',
    );

    assert.doesNotMatch(result.html, /Hidden payload/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('removes an input value that explicitly inherits zero font size', async () => {
    const result = await cleanBody(
      '<div style="font-size:0"><input style="font-size:inherit" value="Hidden payload">' +
      '<p style="font-size:16px">Visible child</p></div>',
    );

    assert.doesNotMatch(result.html, /Hidden payload/);
    assert.match(result.html, /Visible child/);
    assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  for (const { name, style } of [
    { name: 'the user agent font', style: '' },
    { name: 'a visible local override', style: 'font-size:16px' },
    { name: 'an unresolved local font', style: 'font-size:var(--size)' },
  ]) {
    test(`keeps an input value under a zero-font parent with ${name}`, async () => {
      const attribute = style ? ` style="${style}"` : '';
      const result = await cleanBody(
        `<div style="font-size:0"><input${attribute} value="Visible value"></div>`,
      );

      assert.match(result.html, /<input\b[^>]*value="Visible value"/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  test('keeps images and non-text controls with zero font size', async () => {
    const result = await cleanBody(
      '<p><img style="font-size:0" src="https://example.com/visible.png" alt="Visible image"></p>' +
      '<input type="image" style="font-size:0" src="https://example.com/control.png" alt="Image control">' +
      '<input type="checkbox" style="font-size:0" value="Checkbox value">' +
      '<input type="range" style="font-size:0" value="50">' +
      '<input type="button" style="font-size:0" value="Button value">',
    );

    assert.match(result.html, /<img\b[^>]*visible\.png/);
    assert.match(result.html, /<input\b[^>]*control\.png/);
    assert.match(result.html, /<input\b[^>]*value="Checkbox value"/);
    assert.match(result.html, /<input\b[^>]*value="50"/);
    assert.match(result.html, /<input\b[^>]*value="Button value"/);
    assert.equal(result.markdown, '![Visible image](https://example.com/visible.png)\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});

describe('inherited visibility without a local transform', () => {
  for (const transform of ['none', 'initial', 'unset']) {
    test(`removes inherited offscreen text through a fieldset with transform ${transform}`, async () => {
      const result = await cleanBody(
        '<div style="transform:translateX(-1000000px)">' +
        `<fieldset style="transform:${transform}">Hidden payload</fieldset></div>`,
      );

      assert.doesNotMatch(result.html, /Hidden payload/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  for (const tag of ['fieldset', 'x-control']) {
    test(`removes offscreen text through an unstyled ${tag}`, async () => {
      const result = await cleanBody(
        `<div style="transform:translateX(-1000000px)"><${tag}>Hidden payload</${tag}></div>`,
      );

      assert.doesNotMatch(result.html, /Hidden payload/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });

    test(`removes a preserved hidden plane through an unstyled ${tag}`, async () => {
      const result = await cleanBody(
        '<div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
        `<${tag}>Hidden payload</${tag}></div>`,
      );

      assert.doesNotMatch(result.html, /Hidden payload/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  test('keeps an ordinary visible fieldset in HTML', async () => {
    const result = await cleanBody('<fieldset>Visible fieldset</fieldset>');

    assert.match(result.html, /Visible fieldset/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, []);
  });

  test('keeps a positioned fieldset that restores an offscreen ancestor', async () => {
    const result = await cleanBody(
      '<div style="transform:translateX(-1000000px)">' +
      '<fieldset style="position:relative;left:1000000px">Visible fieldset</fieldset></div>',
    );

    assert.match(result.html, /Visible fieldset/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, []);
  });
});

describe('replaced image display', () => {
  test('removes an HTML image suppressed by display contents', async () => {
    const result = await cleanBody(
      '<img style="display:contents" src="https://example.com/hidden.png" alt="Hidden image">',
    );

    assert.doesNotMatch(result.html, /<img\b|hidden\.png|Hidden image/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  for (const { name, style } of [
    { name: 'default display', style: '' },
    { name: 'unresolved display', style: 'display:var(--box)' },
  ]) {
    test(`keeps an image with ${name}`, async () => {
      const attribute = style ? ` style="${style}"` : '';
      const result = await cleanBody(
        `<img${attribute} src="https://example.com/visible.png" alt="Visible image">`,
      );

      assert.match(result.html, /<img\b[^>]*visible\.png/);
      assert.equal(result.markdown, '![Visible image](https://example.com/visible.png)\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }
});

describe('exact rank in accumulated planes', () => {
  const inverse = 'matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)';
  const planarInverse =
    'matrix3d(562949953421313,-562949953421312,0,0,-562949953421312,562949953421312,0,0,0,0,1,0,0,0,0,1)';
  for (const { name, parentStyle, contents, transform } of [
    { name: 'a preserved identity parent', parentStyle: 'transform-style:preserve-3d',
      contents: false, transform: inverse },
    { name: 'a contents wrapper in a preserved context', parentStyle: 'transform-style:preserve-3d',
      contents: true, transform: inverse },
    { name: 'a planar 3D spelling in a preserved context', parentStyle: 'transform-style:preserve-3d',
      contents: false, transform: planarInverse },
    { name: 'a planar 3D spelling in a flat context', parentStyle: '',
      contents: false, transform: planarInverse },
    { name: 'a 2D spelling in a flat context', parentStyle: '', contents: false, transform: inverse },
  ]) {
    test(`keeps an invertible child under ${name}`, async () => {
      const result = await cleanBody(
        `<div style="${parentStyle}">${contents ? '<div style="display:contents">' : ''}` +
        `<p style="transform:${transform}">Visible child</p>${contents ? '</div>' : ''}</div>`,
      );

      assert.match(result.html, /Visible child/);
      assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  test('keeps local text and a flat descendant under a preserved near-singular plane', async () => {
    const result = await cleanBody(
      '<div style="transform-style:preserve-3d;transform:matrix(1,1,1,1.0000000000000018,0,0)">' +
      'Visible parent<p>Visible flat child</p></div>',
    );

    assert.match(result.html, /Visible parent/);
    assert.match(result.html, /Visible flat child/);
    assert.equal(result.markdown, 'Visible parent\n\nVisible flat child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  test('keeps a restored flat subtree nested in a preserved identity context', async () => {
    const result = await cleanBody(
      '<div style="transform-style:preserve-3d">' +
      '<div style="transform:matrix(1,1,1,1.0000000000000018,0,0)">' +
      `<p style="transform:${inverse}">Visible child</p></div></div>`,
    );

    assert.match(result.html, /Visible child/);
    assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});

describe('suppressed meter and progress content', () => {
  for (const tag of ['meter', 'progress']) {
    test(`removes ${tag} fallback text with display contents`, async () => {
      const result = await cleanBody(
        `<${tag} style="display:contents" max="10" value="5">Hidden fallback</${tag}>`,
      );

      assert.doesNotMatch(result.html, new RegExp(`<${tag}\\b|Hidden fallback`));
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });

    test(`keeps default ${tag} content`, async () => {
      const result = await cleanBody(`<${tag} max="10" value="5">Visible fallback</${tag}>`);

      assert.match(result.html, /Visible fallback/);
      assert.equal(result.markdown, 'Visible fallback\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  test('removes a meter with display contents from a class rule', async () => {
    const result = await cleanBody(
      '<meter class="gone" max="10" value="5">Hidden fallback</meter>',
      '<style>.gone{display:contents}</style>',
    );

    assert.doesNotMatch(result.html, /<meter\b|Hidden fallback/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('keeps progress when inline display overrides a contents class', async () => {
    const result = await cleanBody(
      '<progress class="gone" style="display:block" max="10" value="5">Visible fallback</progress>',
      '<style>.gone{display:contents}</style>',
    );

    assert.match(result.html, /Visible fallback/);
    assert.equal(result.markdown, 'Visible fallback\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  test('keeps a meter when important CSS overrides inline display contents', async () => {
    const result = await cleanBody(
      '<meter class="shown" style="display:contents" max="10" value="5">Visible fallback</meter>',
      '<style>.shown{display:block!important}</style>',
    );

    assert.match(result.html, /Visible fallback/);
    assert.equal(result.markdown, 'Visible fallback\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});

describe('deferred declaration grammar', () => {
  for (const value of [
    'env(name garbage)', 'env(name 0 nope)', 'var(--x garbage)', 'var(--,16px)',
    'attr(data-size garbage,16px)', 'attr(|foo,16px)',
  ]) {
    for (const { property, hidden } of [
      { property: 'font-size', hidden: '0' }, { property: 'transform', hidden: 'scale(0)' },
    ]) {
      test(`keeps ${property} hidden after malformed ${value}`, async () => {
        const result = await cleanBody(`<p style="${property}:${hidden};${property}:${value}">Hidden payload</p>`);

        assert.doesNotMatch(result.html, /Hidden payload/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
      });
    }
  }

  for (const value of [
    'env(viewport-segment-width 0 1,16px)', 'env(missing,var(--x,16px))', 'env(missing,)',
    'var(--x,)', 'var(\\2d \\2d x,16px)', 'attr(data-size type(<length>),16px)',
    'attr(data-size px,16px)',
  ]) {
    test(`keeps valid deferred declarations unknown with ${value}`, async () => {
      const result = await cleanBody(
        `<p style="font-size:0;font-size:${value}">Visible font</p>` +
        `<p style="transform:scale(0);transform:${value}">Visible transform</p>`,
      );

      assert.match(result.html, /Visible font/);
      assert.match(result.html, /Visible transform/);
      assert.equal(result.markdown, 'Visible font\n\nVisible transform\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }
});

describe('native control font defaults', () => {
  for (const tag of ['textarea', 'button', 'select']) {
    for (const { name, style, visible } of [
      { name: 'an independent default font', style: '', visible: true },
      { name: 'explicit zero-font inheritance', style: 'font-size:inherit', visible: false },
      { name: 'a visible font override', style: 'font-size:16px', visible: true },
    ]) {
      test(`${visible ? 'keeps' : 'removes'} ${tag} text with ${name}`, async () => {
        const content = tag === 'select' ? '<option>Control text</option>' : 'Control text';
        const attribute = style ? ` style="${style}"` : '';
        const result = await cleanBody(`<div style="font:0% serif"><${tag}${attribute}>${content}</${tag}></div>`);

        if (visible) assert.match(result.html, /Control text/);
        else assert.doesNotMatch(result.html, /Control text/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
      });
    }
  }
});
