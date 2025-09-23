import Link from "next/link";
export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>ComplianceLoop Portal</h1>
      <p>Scaffold ready. Phase-2 will add auth, admin, files, and sync.</p>
      <ul>
        <li><Link href="/portal">/portal (login)</Link></li>
        <li><Link href="/admin">/admin (stub)</Link></li>
      </ul>
    </main>
  );
}
