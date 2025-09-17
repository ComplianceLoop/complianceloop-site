export default function Index() { return null; }
export async function getServerSideProps() {
  return { redirect: { destination: '/index.html', permanent: false } };
}
