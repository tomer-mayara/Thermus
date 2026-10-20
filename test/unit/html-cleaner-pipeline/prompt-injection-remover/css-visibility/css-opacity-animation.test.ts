import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanBody } from './fixtures/css-pipeline.ts';

const reveal = '@keyframes Reveal{from{opacity:0}to{opacity:1}}';

for (const { name, settings, frames = reveal, kept } of [
  { name: 'a delayed zero-duration reveal with forwards fill', settings: 'animation-name:Reveal;animation-delay:3s;animation-fill-mode:forwards', kept: true },
  { name: 'a positive duration', settings: 'animation-name:Reveal;animation-duration:1s', kept: true },
  { name: 'both fill', settings: 'animation-name:Reveal;animation-fill-mode:both', kept: true },
  { name: 'a shorthand reveal', settings: 'animation:Reveal 0s 3s forwards', kept: true },
  { name: 'an escaped matching name', settings: String.raw`animation-name:\52 eveal;animation-fill-mode:forwards`, kept: true },
  { name: 'a quoted matching name', settings: 'animation-name:"Reveal";animation-fill-mode:forwards', kept: true },
  { name: 'a case-mismatched name', settings: 'animation-name:reveal;animation-fill-mode:forwards', kept: false },
  { name: 'a missing name', settings: 'animation-name:missing;animation-fill-mode:forwards', kept: false },
  { name: 'an unrelated keyframe property', settings: 'animation-name:Reveal;animation-fill-mode:forwards', frames: '@keyframes Reveal{to{color:red}}', kept: false },
  { name: 'opacity that stays zero', settings: 'animation-name:Reveal;animation-duration:1s', frames: '@keyframes Reveal{from{opacity:0}to{opacity:0}}', kept: false },
  { name: 'zero duration without fill', settings: 'animation-name:Reveal', kept: false },
  { name: 'zero duration with only backwards fill', settings: 'animation-name:Reveal;animation-fill-mode:backwards', kept: false },
  { name: 'paused playback', settings: 'animation-name:Reveal;animation-duration:1s;animation-play-state:paused', kept: false },
  { name: 'zero iterations', settings: 'animation-name:Reveal;animation-duration:1s;animation-iteration-count:0', kept: false },
  { name: 'a negative delay outside the supported contract', settings: 'animation-name:Reveal;animation-duration:1s;animation-delay:-2s', kept: false },
  { name: 'a later non-revealing definition', settings: 'animation-name:Reveal;animation-duration:1s', frames: reveal + '@keyframes Reveal{to{opacity:0}}', kept: false },
  { name: 'an invalid keyframe offset', settings: 'animation-name:Reveal;animation-duration:1s', frames: '@keyframes Reveal{101%{opacity:1}}', kept: false },
  { name: 'an important keyframe value', settings: 'animation-name:Reveal;animation-duration:1s', frames: '@keyframes Reveal{to{opacity:1!important}}', kept: false },
  { name: 'near-zero opacity', settings: 'animation:Reveal 0s forwards', frames: '@keyframes Reveal{to{opacity:.009}}', kept: false },
  { name: 'opacity at the visible boundary', settings: 'animation:Reveal 0s forwards', frames: '@keyframes Reveal{to{opacity:.01}}', kept: true },
  { name: 'near-zero percentage opacity', settings: 'animation:Reveal 0s forwards', frames: '@keyframes Reveal{to{opacity:.9%}}', kept: false },
  { name: 'percentage opacity at the visible boundary', settings: 'animation:Reveal 0s forwards', frames: '@keyframes Reveal{to{opacity:1%}}', kept: true },
  { name: 'a deferred value after a literal', settings: 'animation:Reveal 0s forwards', frames: '@keyframes Reveal{to{opacity:1;opacity:var(--x)}}', kept: false },
  { name: 'a deferred duplicate offset', settings: 'animation:Reveal 0s forwards', frames: '@keyframes Reveal{to{opacity:1}to{opacity:var(--x)}}', kept: false },
  { name: 'an invalid value after a literal', settings: 'animation:Reveal 0s forwards', frames: '@keyframes Reveal{to{opacity:1;opacity:nonsense}}', kept: true },
  { name: 'a later unsupported definition', settings: 'animation:Reveal 0s forwards', frames: reveal + '@keyframes Reveal{to{opacity:var(--x)}}', kept: false },
  { name: 'none instead of a quoted name', settings: 'animation-name:none;animation-fill-mode:forwards', frames: '@keyframes "none"{to{opacity:1}}', kept: false },
  { name: 'a quoted none name', settings: 'animation-name:"none";animation-fill-mode:forwards', frames: '@keyframes "none"{to{opacity:1}}', kept: true },
  { name: 'inherit instead of a quoted name', settings: 'animation-name:inherit;animation-fill-mode:forwards', frames: '@keyframes "inherit"{to{opacity:1}}', kept: false },
  { name: 'a quoted inherit name', settings: 'animation-name:"inherit";animation-fill-mode:forwards', frames: '@keyframes "inherit"{to{opacity:1}}', kept: true },
]) {
  test(`Given ${name}, when static opacity is zero, then the animation ${kept ? 'keeps opacity unknown' : 'does not supply opacity uncertainty'}`, async () => {
    const result = await cleanBody('<p class="target">TARGET TEXT</p>',
      `<style>${frames}.target{opacity:0;${settings}}</style>`);

    assert.equal(result.html.includes('TARGET TEXT'), kept);
    assert.equal(result.markdown?.includes('TARGET TEXT'), kept);
    assert.match(result.markdown ?? '', /Visible sibling/);
  });
}

for (const { name, rule, inline = '', kept } of [
  { name: 'a later shorthand reset', rule: '.target{animation-name:Reveal;animation-fill-mode:forwards;animation:none}', kept: false },
  { name: 'a later name after shorthand reset', rule: '.target{animation:none;animation-name:Reveal;animation-fill-mode:forwards}', kept: true },
  { name: 'a more specific reset', rule: 'main .target{animation:none}.target{animation-name:Reveal;animation-fill-mode:forwards}', kept: false },
  { name: 'an important longhand before a reset', rule: '.target{animation-name:Reveal!important;animation:none;animation-fill-mode:forwards}', kept: true },
  { name: 'an important shorthand reset', rule: '.target{animation:none!important;animation-name:Reveal;animation-fill-mode:forwards}', kept: false },
  { name: 'an inline reset', rule: '.target{animation-name:Reveal;animation-fill-mode:forwards}', inline: 'animation:none', kept: false },
  { name: 'important zero opacity', rule: '.target{opacity:0!important;animation:Reveal 1s}', kept: false },
]) {
  test(`Given ${name}, when animation declarations cascade, then the target is ${kept ? 'retained' : 'removed'}`, async () => {
    const result = await cleanBody(`<p class="target" style="${inline}">TARGET TEXT</p>`,
      `<style>${reveal}.target{opacity:0}${rule}</style>`);

    assert.equal(result.markdown?.includes('TARGET TEXT'), kept);
  });
}

for (const hiding of ['hidden', 'style="display:none"', 'style="opacity:0!important"']) {
  test(`Given an opacity reveal and independent ${hiding}, when the sanitizer runs, then it still removes the hidden target`, async () => {
    const result = await cleanBody(`<p class="target" ${hiding}>HIDDEN TARGET</p>`,
      `<style>${reveal}.target{opacity:0;animation:Reveal 0s forwards}</style>`);

    assert.doesNotMatch(result.markdown ?? '', /HIDDEN TARGET/);
    assert.match(result.markdown ?? '', /Visible sibling/);
  });
}

for (const keyword of ['none', 'initial', 'inherit', 'unset', 'revert', 'revert-layer']) {
  test(`Given a keyframes string named ${keyword}, when the animation name is an unquoted keyword, then it does not select the string name`, async () => {
    const result = await cleanBody('<p class="target">HIDDEN TARGET</p>',
      `<style>@keyframes "${keyword}"{to{opacity:1}}`
      + `.target{opacity:0;animation-name:${keyword};animation-fill-mode:forwards}</style>`);

    assert.doesNotMatch(result.markdown ?? '', /HIDDEN TARGET/);
  });
}
