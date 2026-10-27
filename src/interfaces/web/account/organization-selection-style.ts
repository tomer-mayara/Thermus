export const ORGANIZATION_SELECTION_STYLE = `
@font-face{font-family:"IBM Plex Sans";src:url("/assets/plex-sans-latin.woff2") format("woff2");font-style:normal;font-weight:100 700;font-display:swap}
@font-face{font-family:"IBM Plex Serif";src:url("/assets/plex-serif-500-latin.woff2") format("woff2");font-style:normal;font-weight:500;font-display:swap}
@font-face{font-family:"IBM Plex Mono";src:url("/assets/plex-mono-400-latin.woff2") format("woff2");font-style:normal;font-weight:400;font-display:swap}
*{box-sizing:border-box}
html{color-scheme:dark}
body{margin:0;min-height:100svh;display:grid;grid-template-rows:auto 1fr auto;background:#17181D;color:#F3F2EE;font:17px/1.55 "IBM Plex Sans",system-ui,sans-serif}
a{color:inherit;text-underline-offset:.2em}
:focus-visible{outline:3px solid #F3F2EE;outline-offset:5px}
.skip-link{position:absolute;left:20px;top:12px;z-index:2;padding:12px 20px;background:#F3F2EE;color:#17181D;transform:translateY(-160%)}
.skip-link:focus{transform:none}
.site-header{border-bottom:1px solid #2C2D34}
.header-content,.organization-layout,.site-footer{width:min(1200px,calc(100% - 48px));margin-inline:auto}
.header-content{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px 24px;padding-top:20px}
.brand{display:inline-flex;align-items:center;min-height:48px;flex-shrink:0}
.brand img{display:block;width:166px;height:auto}
nav{grid-column:1/-1;display:flex;align-items:center;gap:28px;flex-wrap:wrap}
nav a{display:inline-flex;align-items:center;min-height:48px;font-size:15px;color:#B4BAC0;text-decoration:none;border-bottom:2px solid transparent}
nav a:hover{color:#F3F2EE;text-decoration:underline}
nav [aria-current]{color:#F3F2EE;border-bottom-color:#E8552A}
main:focus{outline:none}
.organization-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,540px);gap:80px;align-content:start;align-items:start;padding-block:72px 96px}
.organization-introduction{padding-top:24px;min-width:0}
.eyebrow,.card-caption,.selection-note,.site-footer{font-family:"IBM Plex Mono",ui-monospace,monospace}
.eyebrow{color:#E8552A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 16px}
h1,h2{font-family:"IBM Plex Serif",Georgia,serif;font-weight:500;letter-spacing:-.02em;line-height:1.1;margin:0;overflow-wrap:break-word}
h1{font-size:56px;max-width:14ch}
.introduction-copy{font-size:20px;color:#B4BAC0;margin:24px 0 0;max-width:32ch}
.organization-card{min-width:0;padding:32px;background:#212228;border:1px solid #2C2D34;border-radius:12px}
.card-caption{color:#B4BAC0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 16px}
h2{font-size:32px}
.card-copy{color:#B4BAC0;margin:12px 0 24px}
.organization-list{display:grid;gap:12px;list-style:none;margin:0;padding:0}
.organization-list li,.organization-list form{min-width:0;margin:0}
.organization-list button{position:relative;display:block;min-height:80px;width:100%;padding:20px 56px 20px 20px;border:1px solid #7B7E88;border-radius:8px;background:#17181D;color:#F3F2EE;font:600 18px/1.5 "IBM Plex Sans",system-ui,sans-serif;text-align:left;white-space:normal;overflow-wrap:anywhere;cursor:pointer}
.organization-list button:after{content:"→" / "";position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:24px;font-weight:400;color:#E8552A}
.organization-list button:hover{background:#2C2D34;border-color:#F3F2EE}
.organization-list [aria-current="true"] button{border-color:#E8552A;box-shadow:inset 3px 0 #E8552A}
.selection-note{margin:24px 0 0;padding-top:20px;border-top:1px solid #43454E;color:#B4BAC0;font-size:12px}
.site-footer{padding:24px 0;border-top:1px solid #2C2D34;color:#B4BAC0;font-size:12px}
@media(max-width:960px){
 .organization-layout{grid-template-columns:minmax(0,1fr);gap:32px;max-width:650px;padding-block:36px 48px}
 .organization-introduction{padding:0}
 h1{font-size:40px;max-width:none}
 .introduction-copy{font-size:17px;max-width:none;margin-top:16px}
}
@media(max-width:480px){
 .header-content,.organization-layout,.site-footer{width:calc(100% - 40px)}
 .header-content{gap:8px 16px}
 .brand img{width:120px}
 .organization-card{padding:24px}
 h1{font-size:36px}
 h2{font-size:28px}
 .organization-list button{min-height:72px;font-size:16px;padding-left:16px;padding-right:44px}
 .organization-list button:after{right:16px}
}
@media(max-width:860px){nav{gap:24px}}
@media(forced-colors:active){.organization-list [aria-current="true"] button{border-width:3px}}
`;
