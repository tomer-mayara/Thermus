export const SIGNUP_STYLE = `
@font-face{font-family:"IBM Plex Sans";src:url("/assets/plex-sans-latin.woff2") format("woff2");font-style:normal;font-weight:100 900;font-display:swap}
@font-face{font-family:"IBM Plex Serif";src:url("/assets/plex-serif-500-latin.woff2") format("woff2");font-style:normal;font-weight:500;font-display:swap}
@font-face{font-family:"IBM Plex Mono";src:url("/assets/plex-mono-400-latin.woff2") format("woff2");font-style:normal;font-weight:400;font-display:swap}
*{box-sizing:border-box}
html{color-scheme:dark}
body{margin:0;background:#17181D;color:#F3F2EE;font:17px/1.55 "IBM Plex Sans",system-ui,sans-serif}
a{color:inherit;text-underline-offset:.2em}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:3px solid #F3F2EE;outline-offset:5px}
.skip-link{position:absolute;left:20px;top:12px;z-index:2;padding:12px 20px;background:#F3F2EE;color:#17181D;transform:translateY(-160%)}
.skip-link:focus{transform:none}
.site-header{border-bottom:1px solid #2C2D34}
.header-content,.signup-layout,.site-footer{width:min(1200px,calc(100% - 48px));margin-inline:auto}
.header-content{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{display:inline-flex;flex-shrink:0}
.brand img{display:block;width:166px;height:auto}
.back-link{font-size:15px;color:#B4BAC0;text-decoration:none}
.back-link:hover{color:#F3F2EE;text-decoration:underline}
.signup-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,540px);gap:80px;align-items:start;padding-block:64px 72px}
.signup-layout.activation{grid-template-columns:minmax(0,1fr) minmax(0,650px);gap:56px}
.signup-introduction{padding-top:24px;min-width:0}
.eyebrow,.step-caption,.document-version,.site-footer,.free-note{font-family:"IBM Plex Mono",ui-monospace,monospace}
.eyebrow{color:#E8552A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 16px}
h1,h2{font-family:"IBM Plex Serif",Georgia,serif;font-weight:500;letter-spacing:-.02em;line-height:1.1;margin:0}
h1{font-size:56px;max-width:12ch;overflow-wrap:break-word}
.introduction-copy{font-size:20px;color:#B4BAC0;margin:24px 0 40px;max-width:36ch}
.steps{padding:0;margin:0 0 36px;list-style:none}
.steps li{position:relative;display:grid;grid-template-columns:44px 1fr;column-gap:20px;padding-bottom:28px;color:#B4BAC0}
.steps li:last-child{padding-bottom:0}
.steps li:first-child:after{content:"";position:absolute;top:52px;bottom:8px;left:21px;width:1px;background:#7B7E88}
.step-number{border:1px solid #7B7E88;border-radius:50%;width:44px;height:44px;display:grid;place-items:center;font:18px "IBM Plex Mono",monospace}
.steps [aria-current="step"] .step-number{border:2px solid #E8552A;color:#E8552A}
.step-name{font-weight:600;color:#F3F2EE;display:block;padding-top:5px}
.step-description{display:block;font-size:15px;margin-top:4px}
.free-note{border-top:1px solid #2C2D34;padding-top:20px;font-size:13px;color:#B4BAC0;max-width:42ch}
.task-card{padding:32px;background:#212228;border:1px solid #2C2D34;border-radius:12px;min-width:0}
.task-card h2{font-size:36px;overflow-wrap:break-word}
.step-caption{color:#B4BAC0;font-size:12px;margin:0 0 16px;letter-spacing:.04em}
.task-copy{color:#B4BAC0;margin:16px 0 24px}
.legal-document{border:1px solid #43454E;border-radius:8px;overflow:hidden;margin:0 0 20px;background:#1C1D23;min-width:0;scroll-margin-top:20px}
.document-heading{padding:16px 20px 12px;border-bottom:1px solid #2C2D34}
.document-heading h3{font-size:19px;font-weight:600;margin:0}
.document-version{font-size:11px;color:#B4BAC0;overflow-wrap:anywhere;margin:6px 0 0}
.document-reader{height:260px;overflow-y:auto;scrollbar-color:#7B7E88 #1C1D23;padding:20px;overscroll-behavior:contain}
.activation .document-reader{height:180px}
.document-reader:focus-visible{outline-offset:-4px}
.document-text{font-size:16px;line-height:1.6;overflow-wrap:anywhere}
.document-text>:first-child{margin-top:0}
.document-text>:last-child{margin-bottom:0}
.document-text h4{font:500 24px/1.2 "IBM Plex Serif",Georgia,serif;margin:24px 0 14px}
.document-text h5{font-size:18px;margin:24px 0 12px}
.document-text h6{font-size:16px;margin:20px 0 10px}
.document-text p{margin:0 0 16px}
.document-text ul,.document-text ol{padding-left:24px}
.document-text table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:14px;margin:16px 0}
.document-text th,.document-text td{padding:8px;border:1px solid #7B7E88;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.document-text code,.document-text pre{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.9em;white-space:pre-wrap;overflow-wrap:anywhere}
.document-text blockquote{margin-inline:0;padding-left:16px;border-left:2px solid #7B7E88}
.scroll-hint{font-size:12px;color:#B4BAC0;margin:0;padding:8px 20px;border-top:1px solid #2C2D34}
.document-mobile{display:none}
.primary-action,.secondary-action,.task-card button{display:flex;justify-content:center;align-items:center;min-height:48px;padding:12px 20px;border-radius:6px;font:600 16px/1.4 "IBM Plex Sans",system-ui,sans-serif;text-decoration:none;width:100%;text-align:center;cursor:pointer}
.primary-action,.task-card button{background:#E8552A;color:#17181D;border:1px solid #E8552A}
.primary-action:hover,.task-card button:hover{background:#F16C45;border-color:#F16C45;text-decoration:none}
.secondary-action{background:transparent;color:#F3F2EE;border:1px solid #7B7E88;margin-top:16px}
.secondary-action:hover{background:#2C2D34;text-decoration:none}
.agreement{display:flex;align-items:flex-start;gap:12px;font-size:14px;margin:24px 0 12px;cursor:pointer}
.agreement input{appearance:none;flex:0 0 20px;width:20px;height:20px;border:1px solid #7B7E88;border-radius:3px;background:#17181D;margin:2px 0 0;cursor:pointer}
.agreement input:checked{background:#F3F2EE;border-color:#F3F2EE}
.agreement input:checked:after{content:"✓";display:block;text-align:center;color:#17181D;font:bold 16px/18px system-ui}
.agreement-text{color:#B4BAC0;white-space:pre-wrap;overflow-wrap:anywhere}
.agreement-links{font-size:14px;color:#B4BAC0;margin:0 0 24px}
.site-footer{padding:24px 0;border-top:1px solid #2C2D34;font-size:12px;color:#B4BAC0}
.notice-layout{max-width:900px;grid-template-columns:minmax(0,1fr);padding-block:64px}
.notice-layout .signup-introduction{padding:0}
.notice-layout h1{max-width:none;font-size:44px}
.notice-layout .task-card{max-width:650px}
.notice-message{color:#B4BAC0;margin:0 0 24px;overflow-wrap:anywhere}
.notice-message:last-child{margin-bottom:0}
@media(max-width:960px){
 .signup-layout,.signup-layout.activation{grid-template-columns:minmax(0,1fr);gap:32px;max-width:650px;padding-block:36px 48px}
 .signup-introduction{padding:0}
 h1{font-size:40px;max-width:none}
 .introduction-copy{font-size:16px;max-width:none;margin:16px 0 24px}
 .steps{display:flex;gap:24px;margin-bottom:0}
 .steps li{grid-template-columns:32px 1fr;gap:10px;padding:0;flex:1;font-size:14px}
 .steps li:first-child:after,.step-description,.signup-introduction .free-note{display:none}
 .step-number{width:32px;height:32px;font-size:14px}
 .step-name{padding-top:4px}
 .document-desktop{display:none}
 .document-mobile{display:block;padding:16px 20px}
 .document-excerpt{font-size:16px;color:#B4BAC0;overflow-wrap:anywhere}
 .document-excerpt p{margin:0 0 12px}
 .document-mobile:has(details[open]) .document-excerpt{display:none}
 .document-mobile summary{cursor:pointer;min-height:44px;align-content:center;font-size:15px;text-decoration:underline;text-underline-offset:.2em;background:#1C1D23}
 .document-mobile details[open] summary{position:sticky;top:0;padding-block:12px;z-index:1}
 .document-mobile details[open] .document-text{padding-top:12px}
 .hide-label,details[open] .read-label{display:none}
 details[open] .hide-label{display:inline}
 .notice-layout h1{font-size:36px}
}
@media(max-width:480px){
 .header-content,.signup-layout,.site-footer{width:calc(100% - 40px)}
 .header-content{min-height:72px;gap:16px}
 .brand img{width:120px}
 .back-link{font-size:13px}
 .task-card{padding:24px}
 .task-card h2{font-size:30px}
 .document-heading{padding:14px 16px 10px}
 .document-mobile{padding:12px 16px}
 .document-heading h3{font-size:18px}
 .document-version{font-size:10px}
 .agreement{font-size:14px;gap:10px}
 .task-copy{font-size:16px}
}
@media(forced-colors:active){.agreement input{appearance:auto}}
`;
