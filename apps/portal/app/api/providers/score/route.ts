// ...inside your POST handler, after parsing zip, services, limit:
const sql = getSql();

// Build as plain SQL with positional params
const query = `
  WITH prov AS (
    SELECT p.id,
           p.company_name,
           p.contact_email AS email,
           p.contact_phone AS phone
    FROM providers p
    JOIN provider_zips z
      ON z.provider_id = p.id
     AND z.zip LIKE $1
  )
  SELECT p.id,
         p.company_name,
         p.email,
         p.phone
  FROM prov p
  WHERE (
    SELECT COUNT(DISTINCT s.service_code)
    FROM provider_services s
    WHERE s.provider_id = p.id
      AND s.service_code = ANY($2::text[])
  ) = $3
  ORDER BY p.company_name ASC
  LIMIT $4;
`;

// Pass values in an array: [zipPrefix, servicesArray, servicesCount, limit]
const values = [zip + "%", services, services.length, limit];

// Neon supports sql(text, params[])
const rows = await sql(query, values) as {
  id: string;
  company_name: string;
  email: string | null;
  phone: string | null;
}[];
