import { database } from "../lib/db";
import { policies } from "../data/demo";
import { embed } from "../lib/ai";
const pool = database();
try {
  for (const policy of policies) {
    const embedding =
      process.env.VERTEX_EMBEDDING_MODEL && process.env.GOOGLE_CLOUD_PROJECT
        ? await embed(policy.text)
        : null;
    await pool.query(
      "INSERT INTO policies(id,payload,from_year,to_year,search,embedding,embedding_model) VALUES($1,$2,$3,$4,to_tsvector('english',$5),$6::vector,$7) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,from_year=excluded.from_year,to_year=excluded.to_year,search=excluded.search,embedding=excluded.embedding,embedding_model=excluded.embedding_model",
      [
        policy.id,
        policy,
        policy.fromYear,
        policy.toYear,
        `${policy.title} ${policy.text}`,
        embedding ? JSON.stringify(embedding) : null,
        embedding ? process.env.VERTEX_EMBEDDING_MODEL : null,
      ],
    );
  }
  console.log(
    `Seeded ${policies.length} reviewed policy summaries. No official distances fabricated.`,
  );
} finally {
  await pool.end();
}
