import { db } from "../lib/db";
import { customers, jobs } from "../db/schema";

async function main(){
  const now = new Date();
  const [c] = await db.insert(customers).values({
    name: "Acme Corp",
    email: "ops@example.com",
    portalSlug: "acme",
    portalSecret: "seeded-secret",
  }).returning({ id: customers.id }).catch(()=>[] as any);

  const customerId = c?.id ?? 1;

  await db.insert(jobs).values([
    { customerId, title:"Annual Inspection", address:"123 Main St", startAt:new Date(now.getTime()+86400000), status:"UPCOMING" },
    { customerId, title:"Completed Test", address:"456 Pine Ave", startAt:new Date(now.getTime()-86400000*7), endAt:new Date(now.getTime()-86400000*7+3600000), status:"COMPLETED" }
  ]).catch(()=>{});
}

main().then(()=>console.log("seeded")).catch(e=>{ console.error(e); process.exit(1); });
