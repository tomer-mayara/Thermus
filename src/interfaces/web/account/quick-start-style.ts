export const QUICK_START_STYLE = `
.quick-start-layout.members-layout{display:block;max-width:872px;padding-top:40px}
.quick-start-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}
.quick-start-header h1{margin-bottom:8px}
.quick-start-header p{margin:0;color:#B4BAC0;font-size:15px}
.quick-start-layout .quick-start-copy{display:inline-flex;align-items:center;gap:8px}
.quick-start-copy-icon{font-size:20px;font-weight:400;line-height:1}
.quick-start-layout [hidden]{display:none!important}
.quick-start-steps{display:grid;gap:16px}
.quick-start-step{min-width:0;display:grid;grid-template-columns:26px minmax(0,1fr);gap:15px;padding:24px;background:#212228;border:1px solid #43454E;border-radius:7px}
.quick-start-number{color:#E8552A;font:500 23px/1.25 "IBM Plex Serif",Georgia,serif}
.quick-start-step h2{font:500 19px/1.4 "IBM Plex Sans",system-ui,sans-serif;letter-spacing:0;margin:0 0 9px}
.quick-start-step p{margin:0 0 12px;font-size:15px;color:#B4BAC0}
.quick-start-action{display:inline-flex;align-items:center;justify-content:center;min-height:48px;max-width:100%;padding:10px 14px;border:1px solid #7B7E88;border-radius:6px;font-size:15px;text-decoration:none;overflow-wrap:anywhere}
.quick-start-action:hover{background:#2C2D34;border-color:#F3F2EE}
.quick-start-invite{background:#E8552A;color:#17181D;border-color:#E8552A}
.quick-start-invite:hover{background:#F06B45}
.quick-start-details{margin-top:16px;border-top:1px solid #43454E;padding-top:7px}
.quick-start-details summary,.quick-start-manual summary{min-height:48px;align-content:center;font-size:15px;cursor:pointer}
.quick-start-providers{display:grid;gap:15px;margin:14px 0}
.quick-start-providers h3{font:500 15px/1.5 "IBM Plex Sans",system-ui,sans-serif;margin:0 0 3px}
.quick-start-provider-links{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:14px}
.quick-start-provider-links a{overflow-wrap:anywhere;min-height:32px;align-content:center}
.quick-start-step .quick-start-note{font-size:13px;margin-top:12px}
.quick-start-audit-sequence{padding-left:20px;color:#B4BAC0;font-size:14px;margin:0 0 14px}
.quick-start-audit-sequence li{margin-bottom:5px}
.quick-start-planned{border-top:1px solid #43454E;margin-top:18px;padding-top:14px;color:#B4BAC0;font-size:14px}
.quick-start-planned h3{font:500 14px/1.5 "IBM Plex Sans",system-ui,sans-serif;margin:0 0 5px}
.quick-start-planned p{font-size:13px;margin:0}
.quick-start-verify{margin:24px 0;color:#B4BAC0;font-size:14px}
.quick-start-manual{border-top:1px solid #43454E;padding-top:8px;margin-top:20px;min-width:0}
.quick-start-manual label{display:block;margin:12px 0 8px}
.quick-start-manual textarea{display:block;width:100%;max-width:100%;min-height:260px;resize:vertical;padding:12px;background:#17181D;color:#F3F2EE;border:1px solid #7B7E88;border-radius:6px;font:16px/1.5 "IBM Plex Sans",system-ui,sans-serif}
.quick-start-copy-status{min-height:1.55em;margin:0 0 12px;color:#B4BAC0;font-size:14px}
@media(max-width:600px){.quick-start-header{align-items:flex-start;flex-direction:column;gap:18px}.quick-start-step{padding:20px 16px;gap:10px;grid-template-columns:21px minmax(0,1fr)}.quick-start-layout.members-layout{padding-top:28px}}
`;
