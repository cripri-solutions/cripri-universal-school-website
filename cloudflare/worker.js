const DEFAULT_DOMAIN = "criprisolutions.co.ke";
const RESERVED_SUBDOMAINS = new Set(["www","api","admin","manager","app","mail","ftp","support","help","docs","status","assets","static"]);

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[c]);

const safeUrl = (value) => {
  if (!value) return "";
  try { const url = new URL(value); return ["https:","http:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-KE",{day:"numeric",month:"long",year:"numeric"}).format(date);
};

async function supabaseGet(env, table, params) {
  const base = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error("School website service is not configured.");
  const url = new URL(base + "/rest/v1/" + table);
  Object.entries(params).forEach(([name,value]) => url.searchParams.set(name,value));
  const response = await fetch(url, { headers: { apikey:key, Authorization:"Bearer " + key, Accept:"application/json" } });
  if (!response.ok) throw new Error("School data request failed (" + response.status + ").");
  return response.json();
}

function renderContentItem(item) {
  const title = escapeHtml(item.title || "School update");
  const summary = escapeHtml(item.summary || "");
  const body = escapeHtml(item.body || "").replace(/\r?\n/g,"<br>");
  const date = formatDate(item.event_start_at || item.created_at);
  const media = safeUrl(item.media_path);
  const video = safeUrl(item.video_url);
  const mediaMarkup = media ? '<img class="content-media" src="' + escapeHtml(media) + '" alt="' + title + '" loading="lazy">' : "";
  const videoMarkup = video ? '<p><a class="text-link" href="' + escapeHtml(video) + '" target="_blank" rel="noopener noreferrer">Watch video</a></p>' : "";
  return '<article class="update-card"><div class="update-meta">' +
    escapeHtml(String(item.content_type || "update").replaceAll("_"," ")) +
    (date ? " · " + escapeHtml(date) : "") + '</div><h3>' + title + '</h3>' +
    (summary ? '<p class="summary">' + summary + '</p>' : "") +
    (body ? '<p>' + body + '</p>' : "") + mediaMarkup + videoMarkup + '</article>';
}

function renderSchoolPage(school, items, hostname) {
  const name = escapeHtml(school.name || "School");
  const motto = escapeHtml(school.motto || "");
  const description = escapeHtml(school.description || school.welcome_message || "Welcome to our school website.");
  const address = escapeHtml([school.physical_address,school.county,school.country].filter(Boolean).join(", "));
  const email = escapeHtml(school.contact_email || "");
  const phone = escapeHtml(school.contact_phone || "");
  const logo = safeUrl(school.logo_path);
  const banner = safeUrl(school.banner_path);
  const canonical = "https://" + hostname + "/";
  const latest = items.map(renderContentItem).join("");
  const logoMarkup = logo ? '<img class="school-logo" src="' + escapeHtml(logo) + '" alt="' + name + ' logo">' :
    '<span class="school-mark" aria-hidden="true">' + escapeHtml((school.name || "S").trim().charAt(0).toUpperCase()) + '</span>';
  const bannerStyle = banner ? 'style="background-image:linear-gradient(90deg,rgba(13,39,34,.88),rgba(13,39,34,.38)),url(' + "'" + escapeHtml(banner) + "'" + ')"' : "";
  const contact = [
    email ? '<a href="mailto:' + email + '">' + email + '</a>' : "",
    phone ? '<a href="tel:' + phone.replace(/[^\d+]/g,"") + '">' + phone + '</a>' : "",
    address ? "<span>" + address + "</span>" : ""
  ].filter(Boolean).join("");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="description" content="' + description + '"><meta name="theme-color" content="#123b35">' +
    '<link rel="canonical" href="' + escapeHtml(canonical) + '"><title>' + name + ' | CRIPRI School Website</title>' +
    '<style>:root{color-scheme:light;--ink:#172b27;--muted:#62716c;--green:#123b35;--green2:#1d594c;--gold:#d7b65c;--paper:#f5f7f4;--line:#e2e9e4}*{box-sizing:border-box}body{margin:0;color:var(--ink);font:16px/1.65 system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#fff}a{color:inherit}.container{width:min(1120px,92%);margin:auto}.topline{background:var(--green);color:#e9f0ec;font-size:.82rem;padding:8px 0}.header{background:#fff;border-bottom:1px solid var(--line)}.head{min-height:82px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:13px;text-decoration:none;font-weight:800;color:var(--green)}.school-logo{width:52px;height:52px;object-fit:contain}.school-mark{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:#eaf1ed;color:var(--green);font-size:1.4rem;font-weight:800}.brand small{display:block;color:var(--muted);font-size:.75rem;font-weight:500}.nav{display:flex;gap:22px;flex-wrap:wrap}.nav a{text-decoration:none;font-size:.9rem;font-weight:650}.hero{color:#fff;background-color:var(--green);background-image:linear-gradient(110deg,rgba(10,43,36,.96),rgba(18,59,53,.74));background-size:cover;background-position:center}.hero-inner{padding:78px 0 84px;max-width:850px}.eyebrow{text-transform:uppercase;letter-spacing:.15em;font-size:.75rem;font-weight:800;color:var(--gold)}h1{font-size:clamp(2.3rem,6vw,4.4rem);line-height:1.06;margin:12px 0 18px;max-width:820px}.hero p{font-size:1.1rem;color:#e2ece6}.button{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:5px;background:var(--gold);color:#20372e;text-decoration:none;font-weight:800}.section{padding:64px 0}.section-tint{background:var(--paper)}.section-head{max-width:760px;margin-bottom:28px}.section h2{font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.15;color:var(--green);margin:8px 0 12px}.muted{color:var(--muted)}.updates{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.update-card{padding:22px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px #123b3509}.update-meta{font-size:.76rem;text-transform:uppercase;letter-spacing:.08em;color:var(--green2);font-weight:800}.update-card h3{margin:8px 0;color:var(--green)}.update-card p{margin:8px 0}.update-card .summary{font-weight:650}.content-media{display:block;width:100%;max-height:260px;object-fit:cover;border-radius:8px;margin-top:14px}.text-link{color:var(--green2);font-weight:750}.contact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.contact-grid a,.contact-grid span{padding:18px;border:1px solid var(--line);border-radius:9px;overflow-wrap:anywhere}.contact-grid a{color:var(--green2)}.footer{padding:28px 0;background:#102f2b;color:#e5eee9}.footer small{color:#b8cbc2}.empty{padding:22px;border:1px dashed #bdcfc4;border-radius:10px;color:var(--muted)}@media(max-width:700px){.head{align-items:flex-start;padding:14px 0;flex-direction:column}.nav{gap:14px}.hero-inner{padding:55px 0}.section{padding:48px 0}}</style></head><body>' +
    '<div class="topline"><div class="container">A school website powered by CRIPRI Technologies</div></div>' +
    '<header class="header"><div class="container head"><a class="brand" href="#home">' + logoMarkup + '<span>' + name +
    (motto ? '<small>' + motto + '</small>' : '<small>Official school website</small>') +
    '</span></a><nav class="nav" aria-label="Main navigation"><a href="#about">About</a><a href="#updates">News &amp; events</a><a href="#contact">Contact</a></nav></div></header>' +
    '<main id="home"><section class="hero" ' + bannerStyle + '><div class="container hero-inner"><div class="eyebrow">Welcome to our school</div><h1>' + name + '</h1>' +
    (motto ? '<p><strong>' + motto + '</strong></p>' : "") + '<p>' + description + '</p><a class="button" href="#about">Discover our school</a></div></section>' +
    '<section class="section" id="about"><div class="container section-head"><div class="eyebrow">Our school</div><h2>Welcome</h2><p class="muted">' + description + '</p></div></section>' +
    '<section class="section section-tint" id="updates"><div class="container"><div class="section-head"><div class="eyebrow">Stay informed</div><h2>News, announcements and events</h2><p class="muted">Updates published by the school\'s authorised website team.</p></div><div class="updates">' +
    (latest || '<div class="empty">There are no published updates yet. Please check again soon.</div>') +
    '</div></div></section><section class="section" id="contact"><div class="container"><div class="section-head"><div class="eyebrow">Get in touch</div><h2>Contact the school</h2></div><div class="contact-grid">' +
    (contact || '<div class="empty">Official contact information will be added by the school.</div>') +
    '</div></div></section></main><footer class="footer"><div class="container"><strong>' + name + '</strong><br><small>Website powered by CRIPRI Technologies · ' +
    escapeHtml(hostname) + '</small></div></footer></body></html>';
}

export default {
  async fetch(request, env) {
    const domain = String(env.PLATFORM_DOMAIN || DEFAULT_DOMAIN).toLowerCase();
    const hostname = new URL(request.url).hostname.toLowerCase();
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed",{status:405,headers:{Allow:"GET, HEAD","Cache-Control":"no-store"}});
    }
    if (!hostname.endsWith("." + domain)) return new Response("Not found",{status:404});
    const slug = hostname.slice(0,-(domain.length + 1));
    if (!slug || slug.includes(".") || RESERVED_SUBDOMAINS.has(slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return new Response("School website not found",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
    }
    try {
      const schools = await supabaseGet(env,"schools",{
        select:"id,name,slug,motto,description,welcome_message,physical_address,county,country,contact_phone,contact_email,logo_path,banner_path",
        slug:"eq." + slug,status:"eq.active",limit:"1"
      });
      if (!Array.isArray(schools) || schools.length !== 1) {
        return new Response("This school website is not available.",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
      }
      const school = schools[0];
      const items = await supabaseGet(env,"school_content_items",{
        select:"content_type,title,summary,body,event_start_at,created_at,media_path,video_url,publish_at,status",
        school_id:"eq." + school.id,status:"eq.published",
        or:"(publish_at.is.null,publish_at.lte." + new Date().toISOString() + ")",
        order:"created_at.desc",limit:"30"
      });
      const html = renderSchoolPage(school,Array.isArray(items) ? items : [],hostname);
      const headers = {
        "Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=60, s-maxage=120",
        "X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin",
        "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy":"default-src 'self' https: data:; img-src 'self' https: data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
      };
      return new Response(request.method === "HEAD" ? null : html,{status:200,headers});
    } catch (error) {
      console.error("CRIPRI school subdomain router:",error);
      return new Response("The school website is temporarily unavailable. Please try again shortly.",{
        status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
      });
    }
  }
};