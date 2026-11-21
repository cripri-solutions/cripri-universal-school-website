import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const school = {
  id:"school-1",name:"TELWA GIRLS",slug:"telwa-girls",
  motto:"Soaring on the Springs of Success",description:"Welcome to TELWA GIRLS.",
  physical_address:null,county:"Narok",country:"Kenya",
  contact_email:"office@example.org",contact_phone:null,logo_path:null,banner_path:null
};
function mockFetch(routes) {
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    const table = url.pathname.split("/").pop();
    if (table === "schools" && url.searchParams.get("slug") !== "eq.telwa-girls") return Response.json([]);
    if (table === "school_content_items") {
      assert.equal(url.searchParams.get("school_id"),"eq.school-1");
      assert.equal(url.searchParams.get("status"),"eq.published");
    }
    return Response.json(routes[table] ?? []);
  };
}
const env = {
  PLATFORM_DOMAIN:"schools.criprisolutions.co.ke",
  SUPABASE_URL:"https://example.supabase.co",
  SUPABASE_ANON_KEY:"test-publishable-key"
};

test("serves an active school's published public page",async () => {
  mockFetch({schools:[school],school_content_items:[{title:"Open Day",summary:"Visit us",content_type:"event",status:"published"}]});
  const response = await worker.fetch(new Request("https://telwa-girls.schools.criprisolutions.co.ke/"),env);
  assert.equal(response.status,200);
  const html = await response.text();
  assert.match(html,/TELWA GIRLS/);
  assert.match(html,/Open Day/);
  assert.match(html,/Soaring on the Springs of Success/);
});
test("returns 404 for unknown schools",async () => {
  mockFetch({schools:[],school_content_items:[]});
  const response = await worker.fetch(new Request("https://unknown-school.schools.criprisolutions.co.ke/"),env);
  assert.equal(response.status,404);
});
test("does not intercept the main CRIPRI www hostname",async () => {
  const response = await worker.fetch(new Request("https://www.criprisolutions.co.ke/"),env);
  assert.equal(response.status,404);
});
test("rejects non-GET methods",async () => {
  const response = await worker.fetch(new Request("https://telwa-girls.criprisolutions.co.ke/",{method:"POST"}),env);
  assert.equal(response.status,405);
});
