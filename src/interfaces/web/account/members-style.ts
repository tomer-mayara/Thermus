export const MEMBERS_STYLE = `
@font-face{font-family:"IBM Plex Sans";src:url("/assets/plex-sans-latin.woff2") format("woff2");font-style:normal;font-weight:100 700;font-display:swap}
@font-face{font-family:"IBM Plex Serif";src:url("/assets/plex-serif-500-latin.woff2") format("woff2");font-style:normal;font-weight:500;font-display:swap}
*{box-sizing:border-box}
html{color-scheme:dark}
body{margin:0;min-height:100svh;display:grid;grid-template-rows:auto 1fr auto;background:#17181D;color:#F3F2EE;font:17px/1.55 "IBM Plex Sans",system-ui,sans-serif}
a{color:inherit;text-underline-offset:.2em}
:focus-visible{outline:3px solid #F3F2EE;outline-offset:5px}
.skip-link{position:absolute;left:20px;top:12px;z-index:2;padding:12px 20px;background:#F3F2EE;color:#17181D;transform:translateY(-160%)}
.skip-link:focus{transform:none}
.site-header{border-bottom:1px solid #2C2D34}
.header-content,.members-layout,.site-footer{width:min(1200px,calc(100% - 48px));margin-inline:auto}
.header-content{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;padding-block:12px}
.brand{display:inline-flex;align-items:center;min-height:48px;flex-shrink:0}
.brand img{display:block;width:166px;height:auto}
nav{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
nav a{display:inline-flex;align-items:center;min-height:48px;text-decoration:none;color:#B4BAC0;font-size:15px}
nav a:hover,nav [aria-current]{color:#F3F2EE;text-decoration:underline}
.members-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,380px);grid-template-areas:"intro intro" "lists invite";gap:32px;align-content:start;align-items:start;padding-block:48px 72px}
.members-layout.logging-layout{grid-template-columns:minmax(0,1fr);grid-template-areas:"intro" "invite";max-width:none}
.introduction{grid-area:intro}
.eyebrow{color:#E8552A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px}
h1,h2{font-family:"IBM Plex Serif",Georgia,serif;font-weight:500;letter-spacing:-.02em;line-height:1.2;margin:0;overflow-wrap:anywhere}
h1{font-size:44px}h2{font-size:26px}
.introduction>p:last-child{color:#B4BAC0;margin-bottom:0}
.invite-card,.members-card{min-width:0;padding:28px;background:#212228;border:1px solid #43454E;border-radius:12px}
.invite-card{grid-area:invite}.member-lists{grid-area:lists;display:grid;gap:24px;min-width:0}
p,li,form{overflow-wrap:anywhere;min-width:0}
.invite-card>p,.list-note{font-size:15px;color:#B4BAC0}
.invite-card form{display:grid;gap:12px}
label,legend{font-size:15px}
input[type=email],input[type=url],input[type=password],input[type=text]{min-width:0;width:100%;min-height:48px;padding:12px;border:1px solid #7B7E88;border-radius:6px;background:#17181D;color:#F3F2EE;font:inherit}
fieldset{display:flex;flex-wrap:wrap;gap:12px;border:0;padding:0;margin:4px 0 8px}
legend{padding:0;margin-bottom:6px}
.role-option{display:inline-flex;gap:8px;align-items:center;min-height:48px;padding-right:20px;cursor:pointer}
input[type=checkbox],input[type=radio]{width:20px;height:20px;accent-color:#E8552A}
button{min-height:48px;max-width:100%;padding:12px 16px;border:1px solid #7B7E88;border-radius:6px;background:transparent;color:#F3F2EE;font:600 15px/1.4 "IBM Plex Sans",system-ui,sans-serif;white-space:normal;overflow-wrap:anywhere;cursor:pointer}
button:hover{border-color:#F3F2EE;background:#2C2D34}
.invite-card button{background:#E8552A;border-color:#E8552A;color:#17181D}
.invite-card button:hover{background:#F06B45;border-color:#F06B45}
.logging-switch{position:relative;display:inline-flex;align-items:center;gap:12px;min-height:48px;width:fit-content;cursor:pointer}
.logging-switch input{position:absolute;left:0;width:48px;height:28px;margin:0;opacity:0;cursor:pointer}
.logging-switch-track{pointer-events:none;position:relative;flex-shrink:0;width:48px;height:28px;border:1px solid #7B7E88;border-radius:14px;background:#43454E}
.logging-switch-track::before{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#F3F2EE}
.logging-switch input:checked+.logging-switch-track{background:#E8552A;border-color:#E8552A}
.logging-switch input:checked+.logging-switch-track::before{transform:translateX(20px);background:#17181D}
.logging-switch input:focus-visible+.logging-switch-track{outline:3px solid #F3F2EE;outline-offset:5px}
.logging-switch-on{display:none}
.logging-switch input:checked~.logging-switch-off{display:none}
.logging-switch input:checked~.logging-switch-on{display:inline}
.logging-actions{display:flex;flex-wrap:wrap;gap:12px}
.logging-actions .secondary-action{background:#43454E;border-color:#7B7E88;color:#F3F2EE}
.logging-actions .secondary-action:hover{background:#555862;border-color:#F3F2EE}
.destination-notice{margin-block:20px;padding:16px;border:1px solid #C69754;border-radius:6px;background:#302A20;font-size:15px}.destination-notice p{margin:0}
.policy-note{margin:24px 0 0;padding-top:20px;border-top:1px solid #43454E}
.member-list,.invitation-list{padding:0;margin:20px 0 0;list-style:none}
.member-list li,.invitation-list li{padding-block:20px;border-top:1px solid #43454E}
.member-list li:last-child,.invitation-list li:last-child{padding-bottom:0}
.member-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.member-row p,.invitation-list p{margin:0}
.you-label{font-size:13px;color:#B4BAC0;flex-shrink:0}
.expiry{font-size:13px;color:#B4BAC0;padding-top:8px}
.invitation-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
.invitation-actions form{flex:1 1 180px}.invitation-actions button{width:100%;font-size:13px}
.invitation-actions form[action$="/invitations/revoke"] button{background:#40282C;border-color:#C66E76;color:#FFCDD2}
.invitation-actions form[action$="/invitations/revoke"] button:hover{background:#533038;border-color:#E58F98}
.site-footer{padding:24px 0;border-top:1px solid #2C2D34;color:#B4BAC0;font-size:12px}
@media(max-width:860px){.members-layout{grid-template-columns:minmax(0,1fr);grid-template-areas:"intro" "invite" "lists";max-width:650px;padding-top:32px}.header-content{gap:12px}nav{gap:20px}h1{font-size:40px}}
@media(max-width:480px){.header-content,.members-layout,.site-footer{width:calc(100% - 32px)}.brand img{width:120px}nav{gap:12px}nav a{font-size:13px}.invite-card,.members-card{padding:20px}h1{font-size:36px}h2{font-size:24px}.member-row{gap:8px}.invitation-actions{display:grid;grid-template-columns:minmax(0,1fr)}}
`;
